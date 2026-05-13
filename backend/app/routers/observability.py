from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from ..observability.live_flow import recent_ai_events, sse_event_stream
from ..security.auth import User
from ..security.rbac import require_any_role, require_role

router = APIRouter(prefix="/api/v1/observability", tags=["observability"])


@router.get("/ai-events")
def get_recent_ai_events(
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(require_any_role(("reviewer", "model_admin"))),
) -> list[dict]:
    return recent_ai_events(limit=limit)


@router.get("/ai-events/stream")
def stream_ai_events(
    user: User = Depends(require_role("reviewer")),
) -> StreamingResponse:
    return StreamingResponse(sse_event_stream(), media_type="text/event-stream")
