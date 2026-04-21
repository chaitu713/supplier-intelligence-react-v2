from pydantic import BaseModel, ConfigDict, Field


class RiskOverview(BaseModel):
    highRiskCount: int
    mediumRiskCount: int
    lowRiskCount: int
    avgRiskScore: float

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
    avgDelay: float
    avgDefect: float
    avgCostVariance: float
    riskScore: float
    riskLevel: str

    model_config = ConfigDict(from_attributes=True)


class DueDiligenceRequest(BaseModel):
    supplierId: int = Field(gt=0)


class DueDiligenceResponse(BaseModel):
    supplier: str
    opRisk: str
    esgRisk: str
    overall: str
    issues: list[str]
    aiSummary: str

    model_config = ConfigDict(from_attributes=True)
