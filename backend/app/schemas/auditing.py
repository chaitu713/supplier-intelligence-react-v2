from pydantic import BaseModel, Field


class AuditInsightsRequest(BaseModel):
    audit_id: int = Field(gt=0)


class AuditDecisionRequest(BaseModel):
    audit_id: int = Field(gt=0)


class AuditDecisionApplyRequest(BaseModel):
    audit_id: int = Field(gt=0)
    decision: str = Field(min_length=1)
    notes: str | None = None


class AuditWorkspaceResponse(BaseModel):
    queue: list[dict]
    selected_audit: dict | None
    supplier: dict
    audit_history: list[dict]
    certifications: list[dict]
    evidence_summary: dict
    capa_actions: list[dict]
    metrics: dict


class AuditCapaCreateRequest(BaseModel):
    audit_id: int = Field(gt=0)
    issue: str = Field(min_length=1)
    severity: str = Field(min_length=1)
    owner: str = Field(min_length=1)
    due_date: str = Field(min_length=1)
    evidence_required: str = Field(default="Yes")
    description: str | None = None


class AuditCapaUpdateRequest(BaseModel):
    capa_id: int = Field(gt=0)
    status: str = Field(min_length=1)
    supplier_response: str | None = None
    evidence_notes: str | None = None


class AuditCapaResponse(BaseModel):
    message: str
    capa_action: dict
    audit_rollup: dict


class AuditEvidenceUploadResponse(BaseModel):
    message: str
    evidence: dict
    audit_rollup: dict


class AuditInsightsResponse(BaseModel):
    summary: str
    key_concerns: list[str]
    reviewer_focus: list[str]
    next_actions: list[str]
    suggested_decision: str
    confidence: str


class AuditDecisionResponse(BaseModel):
    recommendation: str
    confidence: str
    reasons: list[str]
    required_actions: list[str]
    closure_blockers: list[str]
    source: str
    provider: str | None = None
    model: str | None = None


class AuditDecisionApplyResponse(BaseModel):
    message: str
    audit_id: int
    audit_decision: str
    audit_status: str
    decision_date: str


class AuditCloseRequest(BaseModel):
    audit_id: int = Field(gt=0)


class AuditCloseResponse(BaseModel):
    message: str
    audit_id: int
    audit_status: str
    closure_blockers: list[str]


class AuditCertificationUpdateRequest(BaseModel):
    supplier_id: int = Field(gt=0)
    cert_name: str = Field(min_length=1)
    issue_date: str = Field(min_length=1)
    expiry_date: str = Field(min_length=1)
    status: str = Field(min_length=1)


class AuditCertificationUpdateResponse(BaseModel):
    supplier_id: int
    cert_name: str
    issue_date: str
    expiry_date: str
    status: str
    expiry_state: str
    message: str


class AuditCertificationExtractResponse(BaseModel):
    supplier_id: int
    cert_name: str
    issue_date: str
    expiry_date: str
    status: str
    expiry_state: str
    extracted_text_preview: str
