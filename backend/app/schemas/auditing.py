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
