from __future__ import annotations

import json
import queue
import threading
from collections import deque
from datetime import UTC, datetime
from typing import Any, Iterator

_EVENTS: deque[dict[str, Any]] = deque(maxlen=200)
_SUBSCRIBERS: list[queue.Queue[dict[str, Any]]] = []
_LOCK = threading.Lock()


def emit_ai_event(event: str, **data: Any) -> dict[str, Any]:
    payload = {
        "event": event,
        "timestamp": datetime.now(UTC).isoformat(),
        **data,
    }
    with _LOCK:
        _EVENTS.append(payload)
        subscribers = list(_SUBSCRIBERS)

    for subscriber in subscribers:
        try:
            subscriber.put_nowait(payload)
        except queue.Full:
            unsubscribe(subscriber)
    return payload


def recent_ai_events(limit: int = 50) -> list[dict[str, Any]]:
    with _LOCK:
        return list(_EVENTS)[-max(1, min(limit, 200)) :]


def subscribe() -> queue.Queue[dict[str, Any]]:
    subscriber: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=100)
    with _LOCK:
        _SUBSCRIBERS.append(subscriber)
    return subscriber


def unsubscribe(subscriber: queue.Queue[dict[str, Any]]) -> None:
    with _LOCK:
        if subscriber in _SUBSCRIBERS:
            _SUBSCRIBERS.remove(subscriber)


def sse_event_stream() -> Iterator[str]:
    subscriber = subscribe()
    try:
        yield 'data: {"event": "connected"}\n\n'
        while True:
            try:
                event = subscriber.get(timeout=25)
            except queue.Empty:
                event = {"event": "heartbeat", "timestamp": datetime.now(UTC).isoformat()}
            yield f"data: {json.dumps(event, default=str)}\n\n"
    finally:
        unsubscribe(subscriber)
