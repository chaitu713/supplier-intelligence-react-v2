from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def _queue_path() -> Path:
    data_dir = Path(__file__).resolve().parents[3] / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "ai_review_queue.json"


def _load_items() -> list[dict[str, Any]]:
    path = _queue_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def _save_items(items: list[dict[str, Any]]) -> None:
    path = _queue_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, indent=2, default=str), encoding="utf-8")


def add_review_item(
    *,
    feature: str,
    reason: str,
    prompt_hash: str = "",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    items = _load_items()
    item = {
        "id": f"review_{uuid.uuid4().hex[:12]}",
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
            item["reviewer_id"] = reviewer_id
            item["reviewed_at"] = datetime.now(UTC).isoformat()
            _save_items(items)
            return item
    raise LookupError("Review item not found")
