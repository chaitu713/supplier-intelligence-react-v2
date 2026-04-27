from pydantic import BaseModel, Field


class AuditInsightsRequest(BaseModel):
    audit_id: int = Field(gt=0)


class AuditInsightsResponse(BaseModel):
    summary: str
    key_concerns: list[str]
    reviewer_focus: list[str]
    next_actions: list[str]
    suggested_decision: str
    confidence: str


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
