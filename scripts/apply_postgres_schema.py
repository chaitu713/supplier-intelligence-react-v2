from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "scripts" / "postgres_schema.sql"


def _psycopg():
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError(
            "PostgreSQL support requires psycopg. Run `pip install -r requirements.txt`."
        ) from exc
    return psycopg


def main() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    parser = argparse.ArgumentParser(description="Apply the PostgreSQL schema to a target database.")
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL URL. Defaults to DATABASE_URL from .env.",
    )
    parser.add_argument(
        "--schema",
        default=str(SCHEMA_PATH),
        help="Path to the SQL schema file.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm that it is safe to run the schema. The default schema drops and recreates tables.",
    )
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required. Set it in .env or pass --database-url.")

    schema_path = Path(args.schema)
    if not schema_path.exists():
        raise SystemExit(f"Schema file not found: {schema_path}")

    if not args.yes:
        raise SystemExit(
            "Refusing to run without --yes. The schema may drop and recreate tables. "
            "Use only on a new/empty database or after backup/approval."
        )

    sql = schema_path.read_text(encoding="utf-8")
    psycopg = _psycopg()
    with psycopg.connect(args.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
        connection.commit()

    print(f"Applied schema: {schema_path}")
    print("PostgreSQL schema setup complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Schema setup failed: {exc}", file=sys.stderr)
        raise
