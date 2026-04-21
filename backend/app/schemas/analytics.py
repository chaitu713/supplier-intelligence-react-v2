from pydantic import BaseModel, ConfigDict


class OverviewMetrics(BaseModel):
    totalSuppliers: int
    avgEsgScore: float
    avgDelayDays: float
    avgDefectRatePct: float
    highRiskCount: int

    model_config = ConfigDict(from_attributes=True)


class CountryDistributionItem(BaseModel):
    country: str
    supplierCount: int

    model_config = ConfigDict(from_attributes=True)


class HistogramBin(BaseModel):
    label: str
    start: float
    end: float
    count: int

    model_config = ConfigDict(from_attributes=True)
