from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..observability.live_flow import emit_ai_event
from .sqlite_data import database_path


def _ensure_review_table() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
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
            """
        )
        existing = {
            row[1]
            for row in connection.execute("PRAGMA table_info(ai_review_queue)").fetchall()
        }
        columns = {
            "trace_id": "TEXT",
            "reason": "TEXT",
            "prompt_hash": "TEXT",
        }
        for column, column_type in columns.items():
            if column not in existing:
                connection.execute(f"ALTER TABLE ai_review_queue ADD COLUMN {column} {column_type}")
        connection.commit()

def _queue_path() -> Path:
    data_dir = Path(__file__).resolve().parents[3] / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "ai_review_queue.json"


def _load_items() -> list[dict[str, Any]]:
    _ensure_review_table()
    with sqlite3.connect(database_path()) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT item_id, trace_id, feature, reason, prompt_hash, status,
                   created_at, reviewed_at, reviewer, payload, decision
            FROM ai_review_queue
            ORDER BY created_at DESC
            """
        ).fetchall()
    items: list[dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["payload"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        items.append(
            {
                "id": row["item_id"],
                "trace_id": row["trace_id"] or "",
                "feature": row["feature"],
                "reason": row["reason"] or "",
                "prompt_hash": row["prompt_hash"] or "",
                "payload": payload,
                "status": row["status"],
                "reviewer_id": row["reviewer"],
                "created_at": row["created_at"],
                "reviewed_at": row["reviewed_at"],
                "decision": row["decision"],
            }
        )
    return items


def _save_items(items: list[dict[str, Any]]) -> None:
    _ensure_review_table()
    with sqlite3.connect(database_path()) as connection:
        connection.execute("DELETE FROM ai_review_queue")
        for item in items:
            connection.execute(
                """
                INSERT INTO ai_review_queue (
                    item_id, trace_id, feature, reason, prompt_hash, status,
                    created_at, reviewed_at, reviewer, payload, decision
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.get("id"),
                    item.get("trace_id", ""),
                    item.get("feature", ""),
                    item.get("reason", ""),
                    item.get("prompt_hash", ""),
                    item.get("status", "pending"),
                    item.get("created_at"),
                    item.get("reviewed_at"),
                    item.get("reviewer_id"),
                    json.dumps(item.get("payload") or {}, default=str),
                    item.get("decision"),
                ),
            )
        connection.commit()


def add_review_item(
    *,
    feature: str,
    reason: str,
    prompt_hash: str = "",
    trace_id: str = "",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    items = _load_items()
    item = {
        "id": f"review_{uuid.uuid4().hex[:12]}",
        "trace_id": trace_id,
        "feature": feature,
        "reason": reason,
        "prompt_hash": prompt_hash,
        "payload": payload or {},
        "status": "pending",
        "reviewer_id": None,
        "created_at": datetime.now(UTC).isoformat(),
        "reviewed_at": None,
    }
    items.append(item)
    _save_items(items)
    emit_ai_event(
        "ai.review_queued",
        trace_id=trace_id,
        feature=feature,
        reason=reason,
        review_item_id=item["id"],
    )
    return item


def list_review_items(status: str = "pending") -> list[dict[str, Any]]:
    items = _load_items()
    if status == "all":
        return items
    return [item for item in items if item.get("status") == status]


def resolve_review_item(item_id: str, decision: str, reviewer_id: str = "local_reviewer") -> dict[str, Any]:
    if decision not in {"approved", "rejected"}:
        raise ValueError("decision must be approved or rejected")

    items = _load_items()
    for item in items:
        if item.get("id") == item_id:
            item["status"] = decision
            item["decision"] = decision
            item["reviewer_id"] = reviewer_id
            item["reviewed_at"] = datetime.now(UTC).isoformat()
            _save_items(items)
            emit_ai_event(
                "ai.review_resolved",
                trace_id=item.get("trace_id", ""),
                feature=item.get("feature", ""),
                review_item_id=item_id,
                decision=decision,
                reviewer_id=reviewer_id,
            )
            return item
    raise LookupError("Review item not found")
