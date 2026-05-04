from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def log_ai_event(
    *,
    feature: str,
    status: str,
    prompt_hash: str,
    provider: str = "",
    model: str = "",
    reason: str = "",
    fallback_used: bool = False,
    metadata: dict[str, Any] | None = None,
) -> None:
    data_dir = Path(__file__).resolve().parents[3] / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    audit_path = data_dir / "ai_audit_events.jsonl"
    event = {
        "timestamp": datetime.now(UTC).isoformat(),
        "feature": feature,
        "status": status,
        "reason": reason,
        "prompt_hash": prompt_hash,
        "provider": provider,
        "model": model,
        "fallback_used": fallback_used,
        "metadata": metadata or {},
    }
    with audit_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, default=str) + "\n")
