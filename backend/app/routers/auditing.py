from fastapi import APIRouter

from ..schemas.auditing import AuditInsightsRequest, AuditInsightsResponse
from ..services.auditing_service import auditing_service

router = APIRouter(prefix="/auditing", tags=["auditing"])


@router.post("/insights", response_model=AuditInsightsResponse)
def get_audit_insights(payload: AuditInsightsRequest) -> AuditInsightsResponse:
    return AuditInsightsResponse(**auditing_service.get_audit_insights(payload.audit_id))
