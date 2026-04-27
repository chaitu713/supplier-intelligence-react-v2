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


class RiskDistributionsResponse(BaseModel):
    overall: list[HistogramBin]
    operational: list[HistogramBin]
    esg: list[HistogramBin]

    model_config = ConfigDict(from_attributes=True)


class CountryAnalysisItem(BaseModel):
    country: str
    supplierCount: int
    avgOverallRisk: float
    avgOperationalRisk: float
    avgEsgRisk: float
    expiringCertifications: int
    expiredCertifications: int

    model_config = ConfigDict(from_attributes=True)


class CountryAnalysisResponse(BaseModel):
    countries: list[CountryAnalysisItem]

    model_config = ConfigDict(from_attributes=True)


class CommodityAnalysisItem(BaseModel):
    commodity: str
    supplierCount: int
    avgOverallRisk: float
    avgOperationalRisk: float
    avgEsgRisk: float
    deforestationRiskScore: float
    avgVolume: float

    model_config = ConfigDict(from_attributes=True)


class CommodityAnalysisResponse(BaseModel):
    commodities: list[CommodityAnalysisItem]

    model_config = ConfigDict(from_attributes=True)


class SupplierRankingItem(BaseModel):
    supplierId: int
    supplierName: str
    country: str | None
    tier: str | None
    overallRiskScore: float
    operationalRiskScore: float
    esgRiskScore: float
    riskLevel: str
    primaryDriver: str

    model_config = ConfigDict(from_attributes=True)


class SupplierRankingsResponse(BaseModel):
    topOverallRisk: list[SupplierRankingItem]
    topOperationalRisk: list[SupplierRankingItem]
    topEsgRisk: list[SupplierRankingItem]
    lowestRisk: list[SupplierRankingItem]

    model_config = ConfigDict(from_attributes=True)


class CertificationCountryItem(BaseModel):
    country: str
    valid: int
    expiringSoon: int
    expired: int

    model_config = ConfigDict(from_attributes=True)


class CertificationSupplierItem(BaseModel):
    supplierId: int
    supplierName: str
    country: str | None
    valid: int
    expiringSoon: int
    expired: int

    model_config = ConfigDict(from_attributes=True)


class CertificationAnalysisResponse(BaseModel):
    byCountry: list[CertificationCountryItem]
    topSuppliers: list[CertificationSupplierItem]

    model_config = ConfigDict(from_attributes=True)


class EsgPillarCountryItem(BaseModel):
    country: str
    environmental: float
    social: float
    governance: float

    model_config = ConfigDict(from_attributes=True)


class EsgPillarSupplierItem(BaseModel):
    supplierId: int
    supplierName: str
    country: str | None
    environmental: float
    social: float
    governance: float

    model_config = ConfigDict(from_attributes=True)


class EsgPillarAnalysisResponse(BaseModel):
    byCountry: list[EsgPillarCountryItem]
    topSuppliers: list[EsgPillarSupplierItem]

    model_config = ConfigDict(from_attributes=True)


class OperationalTrendPoint(BaseModel):
    period: str
    avgDelayDays: float
    avgDefectRatePct: float
    avgCostVariancePct: float
    transactionCount: int

    model_config = ConfigDict(from_attributes=True)


class CertificationTimelinePoint(BaseModel):
    period: str
    issuedCount: int
    expiringCount: int
    expiredCount: int

    model_config = ConfigDict(from_attributes=True)


class TrendSeriesPoint(BaseModel):
    period: str
    value: float

    model_config = ConfigDict(from_attributes=True)


class TrendSeries(BaseModel):
    name: str
    points: list[TrendSeriesPoint]

    model_config = ConfigDict(from_attributes=True)


class TrendAnalysisResponse(BaseModel):
    operational: list[OperationalTrendPoint]
    certificationTimeline: list[CertificationTimelinePoint]
    countryTrends: list[TrendSeries]
    commodityTrends: list[TrendSeries]

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
