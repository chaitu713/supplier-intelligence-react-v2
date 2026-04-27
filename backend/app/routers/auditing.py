from fastapi import APIRouter, File, Form, UploadFile

from ..schemas.auditing import (
    AuditCertificationExtractResponse,
    AuditCertificationUpdateRequest,
    AuditCertificationUpdateResponse,
    AuditInsightsRequest,
    AuditInsightsResponse,
)
from ..services.auditing_service import auditing_service

router = APIRouter(prefix="/auditing", tags=["auditing"])


@router.post("/insights", response_model=AuditInsightsResponse)
def get_audit_insights(payload: AuditInsightsRequest) -> AuditInsightsResponse:
    return AuditInsightsResponse(**auditing_service.get_audit_insights(payload.audit_id))


@router.post("/certification-update", response_model=AuditCertificationUpdateResponse)
def update_supplier_certification(
    payload: AuditCertificationUpdateRequest,
) -> AuditCertificationUpdateResponse:
    return AuditCertificationUpdateResponse(
        **auditing_service.update_supplier_certification(
            supplier_id=payload.supplier_id,
            cert_name=payload.cert_name,
            issue_date=payload.issue_date,
            expiry_date=payload.expiry_date,
            status=payload.status,
        )
    )


@router.post("/certification-extract", response_model=AuditCertificationExtractResponse)
async def extract_supplier_certification(
    supplier_id: int = Form(...),
    expected_cert_name: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> AuditCertificationExtractResponse:
    file_bytes = await file.read()
    return AuditCertificationExtractResponse(
        **auditing_service.extract_supplier_certification(
            supplier_id=supplier_id,
            file_bytes=file_bytes,
            expected_cert_name=expected_cert_name,
        )
    )
