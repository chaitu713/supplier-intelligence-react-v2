from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..schemas.auditing import (
    AuditCertificationExtractResponse,
    AuditCertificationUpdateRequest,
    AuditCertificationUpdateResponse,
    AuditCapaCreateRequest,
    AuditCapaResponse,
    AuditCapaUpdateRequest,
    AuditCloseRequest,
    AuditCloseResponse,
    AuditDecisionApplyRequest,
    AuditDecisionApplyResponse,
    AuditDecisionRequest,
    AuditDecisionResponse,
    AuditEvidenceUploadResponse,
    AuditInsightsRequest,
    AuditInsightsResponse,
    AuditWorkspaceResponse,
)
from ..security.auth import User
from ..security.rbac import require_any_role, require_role
from ..services.auditing_service import auditing_service

router = APIRouter(prefix="/auditing", tags=["auditing"])


@router.get("/workspace", response_model=AuditWorkspaceResponse)
def get_audit_workspace(audit_id: int | None = None) -> AuditWorkspaceResponse:
    return AuditWorkspaceResponse(**auditing_service.get_audit_workspace(audit_id))


@router.post("/insights", response_model=AuditInsightsResponse)
def get_audit_insights(
    payload: AuditInsightsRequest,
    user: User = Depends(require_role("ai_user")),
) -> AuditInsightsResponse:
    return AuditInsightsResponse(**auditing_service.get_audit_insights(payload.audit_id))


@router.post("/decision", response_model=AuditDecisionResponse)
def get_audit_decision(
    payload: AuditDecisionRequest,
    user: User = Depends(require_role("ai_user")),
) -> AuditDecisionResponse:
    return AuditDecisionResponse(**auditing_service.generate_audit_decision(payload.audit_id))


@router.post("/decision/apply", response_model=AuditDecisionApplyResponse)
def apply_audit_decision(
    payload: AuditDecisionApplyRequest,
    user: User = Depends(require_any_role(("reviewer", "compliance_manager"))),
) -> AuditDecisionApplyResponse:
    return AuditDecisionApplyResponse(
        **auditing_service.apply_audit_decision(
            audit_id=payload.audit_id,
            decision=payload.decision,
            notes=payload.notes,
        )
    )


@router.post("/close", response_model=AuditCloseResponse)
def close_audit(
    payload: AuditCloseRequest,
    user: User = Depends(require_any_role(("reviewer", "compliance_manager"))),
) -> AuditCloseResponse:
    return AuditCloseResponse(**auditing_service.close_audit(payload.audit_id))


@router.post("/capa", response_model=AuditCapaResponse)
def create_capa_action(payload: AuditCapaCreateRequest) -> AuditCapaResponse:
    return AuditCapaResponse(**auditing_service.create_capa_action(payload.model_dump()))


@router.patch("/capa", response_model=AuditCapaResponse)
def update_capa_action(payload: AuditCapaUpdateRequest) -> AuditCapaResponse:
    return AuditCapaResponse(**auditing_service.update_capa_action(payload.model_dump()))


@router.post("/evidence/upload", response_model=AuditEvidenceUploadResponse)
async def upload_audit_evidence(
    audit_id: int = Form(...),
    evidence_type: str = Form(...),
    linked_capa_id: int | None = Form(default=None),
    file: UploadFile = File(...),
) -> AuditEvidenceUploadResponse:
    file_bytes = await file.read()
    return AuditEvidenceUploadResponse(
        **auditing_service.upload_audit_evidence(
            audit_id=audit_id,
            evidence_type=evidence_type,
            linked_capa_id=linked_capa_id,
            file_name=file.filename or "audit_evidence",
            file_bytes=file_bytes,
        )
    )


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
