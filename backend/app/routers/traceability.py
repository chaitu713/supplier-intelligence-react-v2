from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from ..core.exceptions import AppError
from ..security.auth import User
from ..security.rbac import require_any_role, require_role
from ..services.traceability_service import traceability_service

router = APIRouter(prefix="/traceability", tags=["traceability"])


class TraceGapActionCreateRequest(BaseModel):
    supplier_id: int
    lot_id: str | None = None
    site_id: str | None = None
    gap_type: str
    severity: str = "Medium"
    status: str = "Open"
    owner: str | None = None
    due_date: str | None = None
    description: str | None = None
    recommended_action: str | None = None


class TraceGapActionUpdateRequest(BaseModel):
    lot_id: str | None = None
    site_id: str | None = None
    gap_type: str | None = None
    severity: str | None = None
    status: str | None = None
    owner: str | None = None
    due_date: str | None = None
    description: str | None = None
    recommended_action: str | None = None
    closure_notes: str | None = None


class TraceDecisionRequest(BaseModel):
    supplier_id: int


class TraceEvidenceReviewRequest(BaseModel):
    evidence_id: int
    review_status: str
    notes: str | None = None


@router.get("/workspace")
def get_traceability_workspace() -> dict:
    return traceability_service.get_workspace_data()


@router.post("/gap-actions")
def create_trace_gap_action(request: TraceGapActionCreateRequest) -> dict:
    try:
        return traceability_service.create_gap_action(request.model_dump())
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.patch("/gap-actions/{gap_id}")
def update_trace_gap_action(gap_id: str, request: TraceGapActionUpdateRequest) -> dict:
    try:
        return traceability_service.update_gap_action(gap_id, request.model_dump(exclude_none=True))
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/decision")
def generate_trace_decision(
    request: TraceDecisionRequest,
    user: User = Depends(require_role("ai_user")),
) -> dict:
    try:
        return traceability_service.generate_trace_decision(request.supplier_id)
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/evidence/review")
def review_trace_evidence(
    request: TraceEvidenceReviewRequest,
    user: User = Depends(require_any_role(("reviewer", "compliance_manager"))),
) -> dict:
    try:
        return traceability_service.review_trace_evidence(
            evidence_id=request.evidence_id,
            review_status=request.review_status,
            notes=request.notes,
        )
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/evidence/upload")
async def upload_traceability_evidence(
    file: UploadFile = File(...),
    supplier_id: str = Form(...),
    evidence_type: str = Form(...),
    linked_entity_type: str | None = Form(default=None),
    linked_entity_id: str | None = Form(default=None),
    linked_entity_name: str | None = Form(default=None),
    gap_id: str | None = Form(default=None),
) -> dict:
    file_bytes = await file.read()
    try:
        return traceability_service.upload_traceability_evidence(
            file_name=file.filename or "traceability_evidence",
            file_bytes=file_bytes,
            supplier_id=supplier_id,
            evidence_type=evidence_type,
            linked_entity_type=linked_entity_type,
            linked_entity_id=linked_entity_id,
            linked_entity_name=linked_entity_name,
            gap_id=gap_id,
        )
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc
