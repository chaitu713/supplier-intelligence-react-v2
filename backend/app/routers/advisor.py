from fastapi import APIRouter, Depends

from ..schemas.advisor import (
    AdvisorMessageRequest,
    AdvisorMessageResponse,
    AdvisorSessionResponse,
)
from ..security.auth import User
from ..security.rbac import require_role
from ..services.advisor_service import advisor_service

router = APIRouter(prefix="/api/v1/advisor", tags=["advisor"])


@router.post("/sessions", response_model=AdvisorSessionResponse)
def create_advisor_session(user: User = Depends(require_role("ai_user"))) -> AdvisorSessionResponse:
    return advisor_service.create_session()


@router.get("/sessions/{session_id}", response_model=AdvisorSessionResponse)
def get_advisor_session(
    session_id: str,
    user: User = Depends(require_role("ai_user")),
) -> AdvisorSessionResponse:
    return advisor_service.get_session(session_id)


@router.delete("/sessions/{session_id}")
def delete_advisor_session(
    session_id: str,
    user: User = Depends(require_role("ai_user")),
) -> dict:
    return advisor_service.delete_session(session_id)


@router.post("/sessions/{session_id}/messages", response_model=AdvisorMessageResponse)
def send_advisor_message(
    session_id: str,
    payload: AdvisorMessageRequest,
    user: User = Depends(require_role("ai_user")),
) -> AdvisorMessageResponse:
    return advisor_service.send_message(session_id, payload)
