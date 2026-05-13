from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .sqlite_data import database_path


def _ensure_audit_table() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_audit_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            """
        )
        existing = {
            row[1]
            for row in connection.execute("PRAGMA table_info(ai_audit_events)").fetchall()
        }
        columns = {
            "trace_id": "TEXT",
            "provider": "TEXT",
            "model": "TEXT",
            "reason": "TEXT",
            "fallback_used": "INTEGER",
        }
        for column, column_type in columns.items():
            if column not in existing:
                connection.execute(f"ALTER TABLE ai_audit_events ADD COLUMN {column} {column_type}")
        connection.commit()

def log_ai_event(
    *,
    feature: str,
    status: str,
    prompt_hash: str,
    trace_id: str = "",
    provider: str = "",
    model: str = "",
    reason: str = "",
    fallback_used: bool = False,
    metadata: dict[str, Any] | None = None,
) -> None:
    _ensure_audit_table()
    timestamp = datetime.now(UTC).isoformat()
    event = {
        "timestamp": timestamp,
        "trace_id": trace_id,
        "feature": feature,
        "status": status,
        "reason": reason,
        "prompt_hash": prompt_hash,
        "provider": provider,
        "model": model,
        "fallback_used": fallback_used,
        "metadata": metadata or {},
    }
    with sqlite3.connect(database_path()) as connection:
        connection.execute(
            """
            INSERT INTO ai_audit_events (
                event_time, trace_id, feature, prompt_hash, status, provider,
                model, reason, fallback_used, details
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                timestamp,
                trace_id,
                feature,
                prompt_hash,
                status,
                provider,
                model,
                reason,
                1 if fallback_used else 0,
                json.dumps(event, default=str),
            ),
        )
        connection.commit()
