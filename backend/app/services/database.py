from __future__ import annotations

import threading
import time
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

POSTGRES_TABLES: dict[str, str] = {
    "esg_monitoring_snapshots": """
        CREATE TABLE IF NOT EXISTS esg_monitoring_snapshots (
            snapshot_id TEXT PRIMARY KEY,
            supplier_id INTEGER,
            snapshot_month TEXT,
            environmental_risk DOUBLE PRECISION,
            social_risk DOUBLE PRECISION,
            governance_risk DOUBLE PRECISION,
            esg_health_score DOUBLE PRECISION,
            anomaly_score DOUBLE PRECISION,
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
            feature_value DOUBLE PRECISION,
            feature_weight DOUBLE PRECISION,
            contribution_score DOUBLE PRECISION,
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
            anomaly_score DOUBLE PRECISION,
            risk_probability DOUBLE PRECISION,
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
            event_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            event_time TEXT,
            trace_id TEXT,
            feature TEXT,
            prompt_hash TEXT,
            status TEXT,
            provider TEXT,
            model TEXT,
            reason TEXT,
            fallback_used INTEGER,
            details TEXT
        )
    """,
    "ai_review_queue": """
        CREATE TABLE IF NOT EXISTS ai_review_queue (
            item_id TEXT PRIMARY KEY,
            trace_id TEXT,
            feature TEXT,
            reason TEXT,
            prompt_hash TEXT,
            status TEXT,
            created_at TEXT,
            reviewed_at TEXT,
            reviewer TEXT,
            payload TEXT,
            decision TEXT
        )
    """,
}

_ORIGINAL_READ_CSV = pd.read_csv
_ORIGINAL_TO_CSV = pd.DataFrame.to_csv
_BRIDGE_INSTALLED = False
_POSTGRES_CONNECTION: Any | None = None
_POSTGRES_LOCK = threading.RLock()
_POSTGRES_TABLE_EXISTS_CACHE: dict[str, bool] = {}
_TABLE_DATA_CACHE_SECONDS = 60
_TABLE_DATA_CACHE: dict[str, tuple[float, pd.DataFrame]] = {}


def using_postgres() -> bool:
    return True


def csv_table_name(file_path: str | Path) -> str | None:
    return CSV_TABLE_MAP.get(Path(file_path).name)


def _database_url() -> str:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is required.")
    if not url.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("DATABASE_URL must be a PostgreSQL connection string.")
    return url


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


def _invalidate_table_cache(table_name: str | None = None) -> None:
    if table_name:
        _TABLE_DATA_CACHE.pop(table_name, None)
        return
    _TABLE_DATA_CACHE.clear()


def _invalidate_cache_for_statement(statement: str) -> None:
    normalized = " ".join(statement.strip().split())
    upper = normalized.upper()
    for keyword in (
        "INSERT INTO",
        "UPDATE",
        "DELETE FROM",
        "DROP TABLE IF EXISTS",
        "DROP TABLE",
        "CREATE TABLE",
    ):
        if upper.startswith(keyword):
            remainder = normalized[len(keyword) :].strip()
            if remainder:
                _invalidate_table_cache(remainder.split()[0].strip('"'))
                return


@contextmanager
def _postgres_connection() -> Iterator[Any]:
    global _POSTGRES_CONNECTION
    psycopg = _psycopg()
    with _POSTGRES_LOCK:
        if _POSTGRES_CONNECTION is None or _POSTGRES_CONNECTION.closed:
            _POSTGRES_CONNECTION = psycopg.connect(_database_url(), connect_timeout=15)
        try:
            yield _POSTGRES_CONNECTION
        except Exception:
            if _POSTGRES_CONNECTION is not None and not _POSTGRES_CONNECTION.closed:
                _POSTGRES_CONNECTION.rollback()
            raise


def table_exists(table_name: str, db_path: Path | None = None) -> bool:
    if db_path is not None:
        raise RuntimeError("File-backed database paths are no longer supported.")
    if table_name in _POSTGRES_TABLE_EXISTS_CACHE:
        return _POSTGRES_TABLE_EXISTS_CACHE[table_name]
    with _postgres_connection() as connection:
        row = connection.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table_name,),
        ).fetchone()
    exists = row is not None
    _POSTGRES_TABLE_EXISTS_CACHE[table_name] = exists
    return exists


def column_names(table_name: str, db_path: Path | None = None) -> set[str]:
    if db_path is not None:
        raise RuntimeError("File-backed database paths are no longer supported.")
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


def execute(statement: str, parameters: Iterable[Any] | None = None) -> None:
    with _postgres_connection() as connection:
        connection.execute(statement, tuple(parameters or ()))
        connection.commit()
    _invalidate_cache_for_statement(statement)


def execute_many(statement: str, rows: Iterable[Iterable[Any]]) -> None:
    with _postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(statement, rows)
        connection.commit()
    _invalidate_cache_for_statement(statement)


def fetch_all(statement: str, parameters: Iterable[Any] | None = None) -> list[dict[str, Any]]:
    from psycopg.rows import dict_row

    with _postgres_connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(statement, tuple(parameters or ()))
            rows = cursor.fetchall()
    return [dict(row) for row in rows]


def read_table(table_name: str, db_path: Path | None = None) -> pd.DataFrame:
    if db_path is not None:
        raise RuntimeError("File-backed database paths are no longer supported.")
    cached = _TABLE_DATA_CACHE.get(table_name)
    now = time.monotonic()
    if cached and now - cached[0] < _TABLE_DATA_CACHE_SECONDS:
        return cached[1].copy(deep=True)

    rows = fetch_all(f"SELECT * FROM {_quote_identifier(table_name)}")
    data_frame = pd.DataFrame(rows)
    _TABLE_DATA_CACHE[table_name] = (now, data_frame.copy(deep=True))
    return data_frame


def _postgres_type_for_series(series: pd.Series) -> str:
    if pd.api.types.is_integer_dtype(series):
        return "BIGINT"
    if pd.api.types.is_float_dtype(series):
        return "DOUBLE PRECISION"
    if pd.api.types.is_bool_dtype(series):
        return "BOOLEAN"
    return "TEXT"


def write_table(table_name: str, data_frame: pd.DataFrame, db_path: Path | None = None) -> None:
    if db_path is not None:
        raise RuntimeError("File-backed database paths are no longer supported.")
    clean_frame = data_frame.where(pd.notna(data_frame), None)
    quoted_name = _quote_identifier(table_name)
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
    _POSTGRES_TABLE_EXISTS_CACHE[table_name] = True
    _invalidate_table_cache(table_name)


def create_future_tables(db_path: Path | None = None) -> None:
    if db_path is not None:
        raise RuntimeError("File-backed database paths are no longer supported.")
    for statement in POSTGRES_TABLES.values():
        execute(statement)


def _read_csv_bridge(filepath_or_buffer: Any, *args: Any, **kwargs: Any) -> pd.DataFrame:
    if isinstance(filepath_or_buffer, (str, Path)):
        table_name = csv_table_name(filepath_or_buffer)
        if table_name and table_exists(table_name):
            logger.debug("Reading %s from PostgreSQL table %s", filepath_or_buffer, table_name)
            return read_table(table_name)
    return _ORIGINAL_READ_CSV(filepath_or_buffer, *args, **kwargs)


def _to_csv_bridge(self: pd.DataFrame, path_or_buf: Any = None, *args: Any, **kwargs: Any) -> Any:
    if isinstance(path_or_buf, (str, Path)):
        table_name = csv_table_name(path_or_buf)
        if table_name:
            logger.debug("Writing %s to PostgreSQL table %s", path_or_buf, table_name)
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
    logger.info("Installed pandas PostgreSQL bridge for CSV-backed data tables")
