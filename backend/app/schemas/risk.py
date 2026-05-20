from pydantic import BaseModel, ConfigDict, Field


class RiskOverview(BaseModel):
    highRiskCount: int
    mediumRiskCount: int
    lowRiskCount: int
    avgRiskScore: float
    avgOperationalRisk: float
    avgEsgRisk: float
    avgOverallRisk: float

    model_config = ConfigDict(from_attributes=True)


class RiskHistogramBin(BaseModel):
    label: str
    start: float
    end: float
    count: int

    model_config = ConfigDict(from_attributes=True)


class RiskSegmentationItem(BaseModel):
    riskLevel: str
    supplierCount: int

    model_config = ConfigDict(from_attributes=True)


class RiskSupplierItem(BaseModel):
    supplierId: int
    supplierName: str
    country: str | None = None
    category: str | None = None
    tier: str | None = None
    avgDelay: float
    avgDefect: float
    avgCostVariance: float
    operationalRiskScore: float
    esgRiskScore: float
    overallRiskScore: float
    riskScore: float
    operationalRiskLevel: str
    esgRiskLevel: str
    riskLevel: str

    model_config = ConfigDict(from_attributes=True)


class DueDiligenceRequest(BaseModel):
    supplierId: int = Field(gt=0)


class DueDiligenceResponse(BaseModel):
    caseId: str | None = None
    supplier: str
    supplierId: int | None = None
    country: str | None = None
    tier: str | None = None
    status: str | None = None
    opRisk: str
    opRiskScore: float
    esgRisk: str
    esgRiskScore: float
    overall: str
    overallRiskScore: float
    decision: str | None = None
    decisionRationale: list[str] = []
    investigationChecklist: list[dict] = []
    riskDrivers: list[dict] = []
    evidenceGaps: list[str] = []
    recommendedActions: list[str] = []
    connectedSignals: dict = {}
    issues: list[str]
    aiSummary: str
    ai_source: str | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    ai_trace_id: str | None = None

    model_config = ConfigDict(from_attributes=True)
