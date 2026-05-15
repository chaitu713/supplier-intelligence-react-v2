from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable, Iterator

import pandas as pd

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)

CSV_TABLE_MAP = {
    "alerts_v2.csv": "alerts",
    "audits_v2.csv": "audits",
    "audit_capa_v2.csv": "audit_capa",
    "audit_evidence_v2.csv": "audit_evidence",
    "certifications_v2.csv": "certifications",
    "commodities_v2.csv": "commodities",
    "due_diligence_cases_v2.csv": "due_diligence_cases",
    "due_diligence_case_notes_v2.csv": "due_diligence_case_notes",
    "due_diligence_decisions_v2.csv": "due_diligence_decisions",
    "esg_environmental_v2.csv": "esg_environmental",
    "esg_governance_v2.csv": "esg_governance",
    "esg_social_v2.csv": "esg_social",
    "external_esg_signals_v2.csv": "external_esg_signals",
    "monitoring_actions_v2.csv": "monitoring_actions",
    "monitoring_alerts_v2.csv": "monitoring_alerts",
    "monitoring_observations_v2.csv": "monitoring_observations",
    "monitoring_rules_v2.csv": "monitoring_rules",
    "suppliers_v2.csv": "suppliers",
    "supplier_certifications_v2.csv": "supplier_certifications",
    "supplier_commodity_map_v2.csv": "supplier_commodity_map",
    "supplier_evidence_refresh_v2.csv": "supplier_evidence_refresh",
    "supplier_evidence_v2.csv": "supplier_evidence",
    "supplier_features_v2.csv": "supplier_features",
    "supplier_sites_v2.csv": "supplier_sites",
    "traceability_decisions_v2.csv": "traceability_decisions",
    "traceability_events_v2.csv": "traceability_events",
    "traceability_gap_actions_v2.csv": "traceability_gap_actions",
    "traceability_gap_action_history_v2.csv": "traceability_gap_action_history",
    "traceability_lots_v2.csv": "traceability_lots",
    "traceability_score_history_v2.csv": "traceability_score_history",
    "transactions_v2.csv": "transactions",
}

FUTURE_ESG_TABLES_SQLITE: dict[str, str] = {
    "esg_monitoring_snapshots": """
        CREATE TABLE IF NOT EXISTS esg_monitoring_snapshots (
            snapshot_id TEXT PRIMARY KEY,
            supplier_id INTEGER,
            snapshot_month TEXT,
            environmental_risk REAL,
            social_risk REAL,
            governance_risk REAL,
            esg_health_score REAL,
            anomaly_score REAL,
            open_alert_count INTEGER,
            stale_evidence_count INTEGER,
            certification_gap_count INTEGER,
            trend_label TEXT,
            created_at TEXT
        )
    """,
    "esg_monitoring_feature_scores": """
        CREATE TABLE IF NOT EXISTS esg_monitoring_feature_scores (
            score_id TEXT PRIMARY KEY,
            supplier_id INTEGER,
            feature_name TEXT,
            feature_value REAL,
            feature_weight REAL,
            contribution_score REAL,
            calculated_at TEXT
        )
    """,
    "esg_monitoring_model_runs": """
        CREATE TABLE IF NOT EXISTS esg_monitoring_model_runs (
            model_run_id TEXT PRIMARY KEY,
            model_name TEXT,
            model_version TEXT,
            run_started_at TEXT,
            run_completed_at TEXT,
            status TEXT,
            input_snapshot_month TEXT,
            notes TEXT
        )
    """,
    "esg_monitoring_predictions": """
        CREATE TABLE IF NOT EXISTS esg_monitoring_predictions (
            prediction_id TEXT PRIMARY KEY,
            model_run_id TEXT,
            supplier_id INTEGER,
            prediction_date TEXT,
            anomaly_score REAL,
            risk_probability REAL,
            signal_label TEXT,
            top_drivers TEXT,
            explanation TEXT
        )
    """,
    "esg_alert_history": """
        CREATE TABLE IF NOT EXISTS esg_alert_history (
            history_id TEXT PRIMARY KEY,
            alert_id TEXT,
            supplier_id INTEGER,
            previous_status TEXT,
            new_status TEXT,
            changed_by TEXT,
            changed_at TEXT,
            notes TEXT
        )
    """,
    "esg_action_comments": """
        CREATE TABLE IF NOT EXISTS esg_action_comments (
            comment_id TEXT PRIMARY KEY,
            action_id TEXT,
            supplier_id INTEGER,
            comment_text TEXT,
            created_by TEXT,
            created_at TEXT
        )
    """,
    "external_signal_ingestion_log": """
        CREATE TABLE IF NOT EXISTS external_signal_ingestion_log (
            ingestion_id TEXT PRIMARY KEY,
            source_name TEXT,
            source_type TEXT,
            ingested_at TEXT,
            records_received INTEGER,
            records_accepted INTEGER,
            records_rejected INTEGER,
            status TEXT,
            notes TEXT
        )
    """,
    "document_uploads": """
        CREATE TABLE IF NOT EXISTS document_uploads (
            upload_id TEXT PRIMARY KEY,
            supplier_id INTEGER,
            module TEXT,
            file_name TEXT,
            file_path TEXT,
            uploaded_at TEXT,
            uploaded_by TEXT,
            extracted_text_available INTEGER,
            notes TEXT
        )
    """,
    "user_activity_log": """
        CREATE TABLE IF NOT EXISTS user_activity_log (
            activity_id TEXT PRIMARY KEY,
            user_name TEXT,
            module TEXT,
            action TEXT,
            entity_type TEXT,
            entity_id TEXT,
            created_at TEXT,
            details TEXT
        )
    """,
    "ai_audit_events": """
        CREATE TABLE IF NOT EXISTS ai_audit_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_time TEXT,
            feature TEXT,
            prompt_hash TEXT,
            status TEXT,
            details TEXT
        )
    """,
    "ai_review_queue": """
        CREATE TABLE IF NOT EXISTS ai_review_queue (
            item_id TEXT PRIMARY KEY,
            feature TEXT,
            status TEXT,
            created_at TEXT,
            reviewed_at TEXT,
            reviewer TEXT,
            payload TEXT,
            decision TEXT
        )
    """,
}

FUTURE_ESG_TABLES_POSTGRES: dict[str, str] = {
    name: statement.replace("REAL", "DOUBLE PRECISION").replace(
        "event_id INTEGER PRIMARY KEY AUTOINCREMENT",
        "event_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY",
    )
    for name, statement in FUTURE_ESG_TABLES_SQLITE.items()
}

_ORIGINAL_READ_CSV = pd.read_csv
_ORIGINAL_TO_CSV = pd.DataFrame.to_csv
_BRIDGE_INSTALLED = False


def using_postgres() -> bool:
    url = get_settings().database_url
    return bool(url and url.startswith(("postgresql://", "postgres://")))


def csv_table_name(file_path: str | Path) -> str | None:
    return CSV_TABLE_MAP.get(Path(file_path).name)


def database_path() -> Path:
    return get_settings().database_file


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _psycopg():
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError(
            "PostgreSQL support requires psycopg. Run `pip install -r requirements.txt`."
        ) from exc
    return psycopg


@contextmanager
def _postgres_connection() -> Iterator[Any]:
    psycopg = _psycopg()
    with psycopg.connect(get_settings().database_url) as connection:
        yield connection


def table_exists(table_name: str, db_path: Path | None = None) -> bool:
    if using_postgres() and db_path is None:
        with _postgres_connection() as connection:
            row = connection.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
                """,
                (table_name,),
            ).fetchone()
        return row is not None

    path = db_path or database_path()
    if not path.exists():
        return False
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        ).fetchone()
    return row is not None


def column_names(table_name: str, db_path: Path | None = None) -> set[str]:
    if using_postgres() and db_path is None:
        with _postgres_connection() as connection:
            rows = connection.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                """,
                (table_name,),
            ).fetchall()
        return {row[0] for row in rows}

    path = db_path or database_path()
    with sqlite3.connect(path) as connection:
        return {row[1] for row in connection.execute(f"PRAGMA table_info({_quote_identifier(table_name)})")}


def execute(statement: str, parameters: Iterable[Any] | None = None) -> None:
    if using_postgres():
        with _postgres_connection() as connection:
            connection.execute(statement, tuple(parameters or ()))
            connection.commit()
        return

    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(statement, tuple(parameters or ()))
        connection.commit()


def execute_many(statement: str, rows: Iterable[Iterable[Any]]) -> None:
    if using_postgres():
        with _postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.executemany(statement, rows)
            connection.commit()
        return

    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.executemany(statement, rows)
        connection.commit()


def fetch_all(statement: str, parameters: Iterable[Any] | None = None) -> list[dict[str, Any]]:
    if using_postgres():
        from psycopg.rows import dict_row

        psycopg = _psycopg()
        with psycopg.connect(get_settings().database_url, row_factory=dict_row) as connection:
            rows = connection.execute(statement, tuple(parameters or ())).fetchall()
        return [dict(row) for row in rows]

    path = database_path()
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(statement, tuple(parameters or ())).fetchall()
    return [dict(row) for row in rows]


def read_table(table_name: str, db_path: Path | None = None) -> pd.DataFrame:
    quoted_name = _quote_identifier(table_name)
    if using_postgres() and db_path is None:
        with _postgres_connection() as connection:
            return pd.read_sql_query(f"SELECT * FROM {quoted_name}", connection)

    path = db_path or database_path()
    if not path.exists():
        raise FileNotFoundError(f"SQLite database not found at {path}")
    with sqlite3.connect(path) as connection:
        return pd.read_sql_query(f"SELECT * FROM {quoted_name}", connection)


def _postgres_type_for_series(series: pd.Series) -> str:
    if pd.api.types.is_integer_dtype(series):
        return "BIGINT"
    if pd.api.types.is_float_dtype(series):
        return "DOUBLE PRECISION"
    if pd.api.types.is_bool_dtype(series):
        return "BOOLEAN"
    return "TEXT"


def write_table(table_name: str, data_frame: pd.DataFrame, db_path: Path | None = None) -> None:
    clean_frame = data_frame.where(pd.notna(data_frame), None)
    quoted_name = _quote_identifier(table_name)

    if using_postgres() and db_path is None:
        column_defs = [
            f"{_quote_identifier(column)} {_postgres_type_for_series(clean_frame[column])}"
            for column in clean_frame.columns
        ]
        columns = [_quote_identifier(column) for column in clean_frame.columns]
        placeholders = ", ".join(["%s"] * len(columns))
        rows = list(clean_frame.itertuples(index=False, name=None))
        with _postgres_connection() as connection:
            connection.execute(f"DROP TABLE IF EXISTS {quoted_name}")
            connection.execute(f"CREATE TABLE {quoted_name} ({', '.join(column_defs)})")
            if rows:
                with connection.cursor() as cursor:
                    cursor.executemany(
                        f"INSERT INTO {quoted_name} ({', '.join(columns)}) VALUES ({placeholders})",
                        rows,
                    )
            connection.commit()
        return

    path = db_path or database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        clean_frame.to_sql(table_name, connection, if_exists="replace", index=False)


def create_future_tables(db_path: Path | None = None) -> None:
    if using_postgres() and db_path is None:
        for statement in FUTURE_ESG_TABLES_POSTGRES.values():
            execute(statement)
        return

    path = db_path or database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        for statement in FUTURE_ESG_TABLES_SQLITE.values():
            connection.execute(statement)
        connection.commit()


def _read_csv_bridge(filepath_or_buffer: Any, *args: Any, **kwargs: Any) -> pd.DataFrame:
    if isinstance(filepath_or_buffer, (str, Path)):
        table_name = csv_table_name(filepath_or_buffer)
        if table_name and table_exists(table_name):
            logger.debug("Reading %s from database table %s", filepath_or_buffer, table_name)
            return read_table(table_name)
    return _ORIGINAL_READ_CSV(filepath_or_buffer, *args, **kwargs)


def _to_csv_bridge(self: pd.DataFrame, path_or_buf: Any = None, *args: Any, **kwargs: Any) -> Any:
    if isinstance(path_or_buf, (str, Path)):
        table_name = csv_table_name(path_or_buf)
        if table_name and (using_postgres() or database_path().exists()):
            logger.debug("Writing %s to database table %s", path_or_buf, table_name)
            write_table(table_name, self)
            return None
    return _ORIGINAL_TO_CSV(self, path_or_buf, *args, **kwargs)


def install_pandas_database_bridge() -> None:
    global _BRIDGE_INSTALLED
    if _BRIDGE_INSTALLED:
        return
    pd.read_csv = _read_csv_bridge
    pd.DataFrame.to_csv = _to_csv_bridge
    _BRIDGE_INSTALLED = True
    logger.info("Installed pandas database bridge for CSV-backed data tables")
