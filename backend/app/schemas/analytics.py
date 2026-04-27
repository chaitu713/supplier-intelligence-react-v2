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


class ExecutiveDashboardKpis(BaseModel):
    totalSuppliers: int
    highRiskSuppliers: int
    avgOverallRisk: float
    avgOperationalRisk: float
    avgEsgRisk: float
    expiringOrExpiredCertifications: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardHealth(BaseModel):
    networkHealth: str
    operationalStability: str
    esgCompliance: str
    suppliersNeedingReview: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardGeographyItem(BaseModel):
    country: str
    supplierCount: int
    riskLevel: str
    avgOverallRisk: float
    avgOperationalRisk: float
    avgEsgRisk: float

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardSupplierItem(BaseModel):
    supplierId: int
    supplierName: str
    riskLevel: str
    overallRiskScore: float
    reason: str

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardAttention(BaseModel):
    geographicExposure: list[ExecutiveDashboardGeographyItem]
    commodityExposure: list["ExecutiveDashboardCommodityItem"]
    suppliersRequiringReview: list[ExecutiveDashboardSupplierItem]

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardCommodityItem(BaseModel):
    commodity: str
    supplierCount: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardRiskMix(BaseModel):
    high: int
    medium: int
    low: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardCertificationHealth(BaseModel):
    valid: int
    expiringSoon: int
    expired: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardRiskMixGroup(BaseModel):
    high: int
    medium: int
    low: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveDashboardResponse(BaseModel):
    reportingDate: str
    kpis: ExecutiveDashboardKpis
    health: ExecutiveDashboardHealth
    riskMix: ExecutiveDashboardRiskMix
    operationalRiskMix: ExecutiveDashboardRiskMixGroup
    esgRiskMix: ExecutiveDashboardRiskMixGroup
    certificationHealth: ExecutiveDashboardCertificationHealth
    attention: ExecutiveDashboardAttention

    model_config = ConfigDict(from_attributes=True)
