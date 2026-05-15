from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..observability.live_flow import emit_ai_event
from .database import column_names, execute, execute_many, fetch_all, using_postgres


def _ensure_review_table() -> None:
    execute(
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
    existing = column_names("ai_review_queue")
    columns = {
        "trace_id": "TEXT",
        "reason": "TEXT",
        "prompt_hash": "TEXT",
    }
    for column, column_type in columns.items():
        if column not in existing:
            execute(f'ALTER TABLE ai_review_queue ADD COLUMN "{column}" {column_type}')

def _queue_path() -> Path:
    data_dir = Path(__file__).resolve().parents[3] / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "ai_review_queue.json"


def _load_items() -> list[dict[str, Any]]:
    _ensure_review_table()
    rows = fetch_all(
        """
        SELECT item_id, trace_id, feature, reason, prompt_hash, status,
               created_at, reviewed_at, reviewer, payload, decision
        FROM ai_review_queue
        ORDER BY created_at DESC
        """
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["payload"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        items.append(
            {
                "id": row.get("item_id"),
                "trace_id": row.get("trace_id") or "",
                "feature": row.get("feature"),
                "reason": row.get("reason") or "",
                "prompt_hash": row.get("prompt_hash") or "",
                "payload": payload,
                "status": row.get("status"),
                "reviewer_id": row.get("reviewer"),
                "created_at": row.get("created_at"),
                "reviewed_at": row.get("reviewed_at"),
                "decision": row.get("decision"),
            }
        )
    return items


def _save_items(items: list[dict[str, Any]]) -> None:
    _ensure_review_table()
    execute("DELETE FROM ai_review_queue")
    placeholder = "%s" if using_postgres() else "?"
    execute_many(
        f"""
        INSERT INTO ai_review_queue (
            item_id, trace_id, feature, reason, prompt_hash, status,
            created_at, reviewed_at, reviewer, payload, decision
        )
        VALUES ({", ".join([placeholder] * 11)})
        """,
        [
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
            )
            for item in items
        ],
    )


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
