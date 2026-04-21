from fastapi import APIRouter

from ..schemas.advisor import (
    AdvisorMessageRequest,
    AdvisorMessageResponse,
    AdvisorSessionResponse,
)
from ..services.advisor_service import advisor_service

router = APIRouter(prefix="/api/v1/advisor", tags=["advisor"])


@router.post("/sessions", response_model=AdvisorSessionResponse)
def create_advisor_session() -> AdvisorSessionResponse:
    return advisor_service.create_session()


@router.get("/sessions/{session_id}", response_model=AdvisorSessionResponse)
def get_advisor_session(session_id: str) -> AdvisorSessionResponse:
    return advisor_service.get_session(session_id)


@router.post("/sessions/{session_id}/messages", response_model=AdvisorMessageResponse)
def send_advisor_message(
    session_id: str,
    payload: AdvisorMessageRequest,
) -> AdvisorMessageResponse:
    return advisor_service.send_message(session_id, payload.message)
