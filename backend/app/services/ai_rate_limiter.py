from __future__ import annotations

import os
import time
from collections import defaultdict, deque


_REQUESTS: dict[str, deque[float]] = defaultdict(deque)


def check_ai_rate_limit(key: str) -> bool:
    limit = int(os.getenv("AI_RATE_LIMIT_RPM", "60"))
    if limit <= 0:
        return True

    now = time.monotonic()
    window_start = now - 60
    bucket = _REQUESTS[key]

    while bucket and bucket[0] < window_start:
        bucket.popleft()

    if len(bucket) >= limit:
        return False

    bucket.append(now)
    return True
