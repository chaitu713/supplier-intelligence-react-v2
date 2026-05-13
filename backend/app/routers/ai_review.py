from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..core.exceptions import AppError
from ..security.auth import User
from ..security.rbac import require_role
from ..services.ai_review_queue import list_review_items, resolve_review_item

router = APIRouter(prefix="/api/v1/ai-review", tags=["ai-review"])


class ReviewDecisionRequest(BaseModel):
    decision: str


@router.get("/queue")
def get_ai_review_queue(
    status: str = "pending",
    user: User = Depends(require_role("reviewer")),
) -> list[dict]:
    return list_review_items(status=status)


@router.post("/queue/{item_id}")
def review_ai_item(
    item_id: str,
    payload: ReviewDecisionRequest,
    user: User = Depends(require_role("reviewer")),
) -> dict:
    try:
        return resolve_review_item(
            item_id=item_id,
            decision=payload.decision,
            reviewer_id=user.id,
        )
    except ValueError as exc:
        raise AppError(str(exc), status_code=400) from exc
    except LookupError as exc:
        raise AppError(str(exc), status_code=404) from exc
