from pydantic import BaseModel, ConfigDict


class EsgMonitoringKpi(BaseModel):
    totalSuppliers: int
    highEsgRiskSuppliers: int
    deterioratingSuppliers: int
    openEsgAlerts: int
    averageEsgHealth: float

    model_config = ConfigDict(from_attributes=True)


class EsgIndicatorSummary(BaseModel):
    key: str
    label: str
    category: str
    averageRisk: float
    highRiskSuppliers: int
    trend: str
    description: str
    isPriority: bool = False

    model_config = ConfigDict(from_attributes=True)


class EsgWatchlistSupplier(BaseModel):
    supplierId: int
    supplierName: str
    country: str | None = None
    tier: str | None = None
    esgRiskScore: float
    esgHealthScore: float
    bwsRisk: float
    hrrRisk: float
    landUseRisk: float
    mlAnomalyScore: float
    mlConfidence: float
    trend: str
    status: str
    primaryConcern: str
    recommendedAction: str

    model_config = ConfigDict(from_attributes=True)


class EsgAlertItem(BaseModel):
    id: str
    supplierId: int
    supplierName: str
    severity: str
    indicator: str
    message: str
    recommendedAction: str

    model_config = ConfigDict(from_attributes=True)


class EsgHealthTrend(BaseModel):
    label: str
    supplierCount: int

    model_config = ConfigDict(from_attributes=True)


class EsgMlFlaggedSupplier(BaseModel):
    supplierId: int
    supplierName: str
    anomalyScore: float
    confidence: float
    signal: str

    model_config = ConfigDict(from_attributes=True)


class EsgMlInsights(BaseModel):
    modelName: str
    monitoringMode: str
    flaggedSuppliers: int
    averageAnomalyScore: float
    topSignals: list[str]
    dataLimitations: list[str]
    flaggedSupplierDetails: list[EsgMlFlaggedSupplier]

    model_config = ConfigDict(from_attributes=True)


class EsgMonitoringOverview(BaseModel):
    kpis: EsgMonitoringKpi
    indicators: list[EsgIndicatorSummary]
    watchlist: list[EsgWatchlistSupplier]
    alerts: list[EsgAlertItem]
    healthTrends: list[EsgHealthTrend]
    mlInsights: EsgMlInsights

    model_config = ConfigDict(from_attributes=True)
