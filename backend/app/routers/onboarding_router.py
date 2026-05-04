from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from ..core.exceptions import AppError

from ..services.onboarding_service import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingDecisionRequest(BaseModel):
    payload: dict


class ActivateSupplierRequest(BaseModel):
    supplier_id: int


class RevalidateSupplierRequest(BaseModel):
    supplier_id: int
    outcome: str
    notes: str | None = None


@router.post("/upload")
async def upload_onboarding_document(
    file: UploadFile | None = File(default=None),
    supplier_name: str | None = Form(default=None),
    country: str | None = Form(default=None),
    tier: str | None = Form(default=None),
    size: str | None = Form(default=None),
    annual_revenue: str | None = Form(default=None),
    onboarding_date: str | None = Form(default=None),
    status: str | None = Form(default=None),
    parent_supplier_id: str | None = Form(default=None),
    esg_baseline_date: str | None = Form(default=None),
    evidence_status: str | None = Form(default=None),
    eudr_relevant: str | None = Form(default=None),
    traceability_required: str | None = Form(default=None),
    site_region: str | None = Form(default=None),
    supplier_role: str | None = Form(default=None),
    plot_traceability_available: str | None = Form(default=None),
    geolocation_evidence_available: str | None = Form(default=None),
    chain_of_custody_available: str | None = Form(default=None),
    deforestation_declaration_available: str | None = Form(default=None),
    labor_questionnaire_status: str | None = Form(default=None),
    traceability_notes: str | None = Form(default=None),
    onboarding_requirements_json: str | None = Form(default=None),
    approval_status: str | None = Form(default=None),
    reviewer_name: str | None = Form(default=None),
    approval_decision: str | None = Form(default=None),
    approval_decision_date: str | None = Form(default=None),
    approval_conditions: str | None = Form(default=None),
    approval_blockers: str | None = Form(default=None),
    carbon: str | None = Form(default=None),
    water: str | None = Form(default=None),
    renewable: str | None = Form(default=None),
    waste: str | None = Form(default=None),
    land: str | None = Form(default=None),
    deforestation: str | None = Form(default=None),
    labor: str | None = Form(default=None),
    child: str | None = Form(default=None),
    hours: str | None = Form(default=None),
    wage: str | None = Form(default=None),
    compliance: str | None = Form(default=None),
    transparency: str | None = Form(default=None),
    policy: str | None = Form(default=None),
    reporting: str | None = Form(default=None),
    commodities: str | None = Form(default=None),
    certifications: str | None = Form(default=None),
    certification_rows: str | None = Form(default=None),
) -> dict:
    if any(
        value is not None
        for value in [
            supplier_name,
            country,
            tier,
            size,
            annual_revenue,
            onboarding_date,
            status,
            parent_supplier_id,
            esg_baseline_date,
            evidence_status,
            eudr_relevant,
            traceability_required,
            site_region,
            supplier_role,
            plot_traceability_available,
            geolocation_evidence_available,
            chain_of_custody_available,
            deforestation_declaration_available,
            labor_questionnaire_status,
            traceability_notes,
            onboarding_requirements_json,
            approval_status,
            reviewer_name,
            approval_decision,
            approval_decision_date,
            approval_conditions,
            approval_blockers,
            carbon,
            water,
            renewable,
            waste,
            land,
            deforestation,
            labor,
            child,
            hours,
            wage,
            compliance,
            transparency,
            policy,
            reporting,
            commodities,
            certifications,
            certification_rows,
        ]
    ):
        return onboarding_service.process_submission(
            supplier_name=supplier_name,
            country=country,
            tier=tier,
            size=size,
            annual_revenue=annual_revenue,
            onboarding_date=onboarding_date,
            status=status,
            parent_supplier_id=parent_supplier_id,
            esg_baseline_date=esg_baseline_date,
            evidence_status=evidence_status,
            eudr_relevant=eudr_relevant,
            traceability_required=traceability_required,
            site_region=site_region,
            supplier_role=supplier_role,
            plot_traceability_available=plot_traceability_available,
            geolocation_evidence_available=geolocation_evidence_available,
            chain_of_custody_available=chain_of_custody_available,
            deforestation_declaration_available=deforestation_declaration_available,
            labor_questionnaire_status=labor_questionnaire_status,
            traceability_notes=traceability_notes,
            onboarding_requirements_json=onboarding_requirements_json,
            approval_status=approval_status,
            reviewer_name=reviewer_name,
            approval_decision=approval_decision,
            approval_decision_date=approval_decision_date,
            approval_conditions=approval_conditions,
            approval_blockers=approval_blockers,
            carbon=carbon,
            water=water,
            renewable=renewable,
            waste=waste,
            land=land,
            deforestation=deforestation,
            labor=labor,
            child=child,
            hours=hours,
            wage=wage,
            compliance=compliance,
            transparency=transparency,
            policy=policy,
            reporting=reporting,
            commodities=commodities,
            certifications=certifications,
            certification_rows=certification_rows,
        )

    if file is None:
        raise AppError("A file is required", status_code=400)

    file_bytes = await file.read()
    if not file_bytes:
        raise AppError("Uploaded file is empty", status_code=400)

    try:
        return onboarding_service.process_document(file_bytes)
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/evidence/upload")
async def upload_onboarding_evidence(
    file: UploadFile = File(...),
    evidence_type: str | None = Form(default=None),
    linked_entity_type: str | None = Form(default=None),
    linked_entity_name: str | None = Form(default=None),
    supplier_id: str | None = Form(default=None),
    temporary_supplier_key: str | None = Form(default=None),
) -> dict:
    file_bytes = await file.read()
    try:
        return onboarding_service.upload_evidence(
            file_name=file.filename or "evidence",
            file_bytes=file_bytes,
            evidence_type=evidence_type,
            linked_entity_type=linked_entity_type,
            linked_entity_name=linked_entity_name,
            supplier_id=supplier_id,
            temporary_supplier_key=temporary_supplier_key,
        )
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/decision")
async def generate_onboarding_decision(request: OnboardingDecisionRequest) -> dict:
    try:
        return onboarding_service.generate_onboarding_decision(request.payload)
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/activate")
async def activate_onboarded_supplier(request: ActivateSupplierRequest) -> dict:
    try:
        return onboarding_service.activate_supplier(request.supplier_id)
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc


@router.post("/revalidate")
async def revalidate_active_supplier(request: RevalidateSupplierRequest) -> dict:
    try:
        return onboarding_service.revalidate_active_supplier(
            supplier_id=request.supplier_id,
            outcome=request.outcome,
            notes=request.notes,
        )
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc
