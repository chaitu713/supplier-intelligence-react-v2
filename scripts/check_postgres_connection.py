from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


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
    parser = argparse.ArgumentParser(description="Check PostgreSQL connectivity.")
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL URL. Defaults to DATABASE_URL from .env.",
    )
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required. Set it in .env or pass --database-url.")

    psycopg = _psycopg()
    with psycopg.connect(args.database_url) as connection:
        row = connection.execute(
            "SELECT current_database(), current_user, version()"
        ).fetchone()

    print("PostgreSQL connection OK")
    print(f"Database: {row[0]}")
    print(f"User: {row[1]}")
    print(f"Version: {row[2]}")


if __name__ == "__main__":
    main()
