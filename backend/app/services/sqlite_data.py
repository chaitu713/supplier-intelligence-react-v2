from __future__ import annotations

from .database import (
    CSV_TABLE_MAP,
    FUTURE_ESG_TABLES_SQLITE as FUTURE_ESG_TABLES,
    create_future_tables,
    csv_table_name,
    database_path,
    install_pandas_database_bridge,
    read_table,
    table_exists,
    write_table,
)


def install_pandas_sqlite_bridge() -> None:
    install_pandas_database_bridge()
