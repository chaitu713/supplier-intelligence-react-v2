from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.services.sqlite_data import CSV_TABLE_MAP, create_future_tables  # noqa: E402


def migrate(csv_dir: Path, db_path: Path, replace: bool) -> list[tuple[str, str, int]]:
    if replace and db_path.exists():
        db_path.unlink()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    migrated: list[tuple[str, str, int]] = []

    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        for csv_name, table_name in sorted(CSV_TABLE_MAP.items(), key=lambda item: item[1]):
            csv_path = csv_dir / csv_name
            if not csv_path.exists():
                print(f"SKIP missing {csv_name}")
                continue

            data_frame = pd.read_csv(csv_path)
            data_frame = data_frame.where(pd.notna(data_frame), None)
            data_frame.to_sql(table_name, connection, if_exists="replace", index=False)
            migrated.append((csv_name, table_name, len(data_frame)))
            print(f"MIGRATED {csv_name} -> {table_name} ({len(data_frame)} rows)")

        connection.commit()

    create_future_tables(db_path)
    return migrated


def print_summary(db_path: Path) -> None:
    with sqlite3.connect(db_path) as connection:
        tables = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        ).fetchall()
        print("\nSQLite tables:")
        for (table_name,) in tables:
            count = connection.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
            print(f"- {table_name}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate Ozone AI CSV datasets into SQLite.")
    parser.add_argument(
        "--csv-dir",
        type=Path,
        default=PROJECT_ROOT / "data",
        help="Directory containing source CSV files.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=PROJECT_ROOT / "data" / "ozone_ai.sqlite3",
        help="SQLite database path to create.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace the SQLite database if it already exists.",
    )
    args = parser.parse_args()

    migrated = migrate(args.csv_dir, args.db, replace=args.replace)
    print_summary(args.db)
    print(f"\nDone. Migrated {len(migrated)} CSV files into {args.db}")


if __name__ == "__main__":
    main()
