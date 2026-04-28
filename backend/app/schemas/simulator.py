from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ScenarioType = Literal[
    "supplier_disruption",
    "country_disruption",
    "commodity_shock",
    "operational_deterioration",
]
SupplierDisruptionSeverity = Literal["moderate", "severe", "unavailable"]
OperationalTargetType = Literal["supplier", "country", "commodity"]


class SimulatorScenarioRequest(BaseModel):
    scenarioType: ScenarioType
    supplierId: int | None = Field(default=None, gt=0)
    severity: SupplierDisruptionSeverity | None = None
    targetType: OperationalTargetType | None = None
    targetValue: str | None = None
    delayIncreasePct: float | None = Field(default=None, ge=0, le=100)
    defectIncreasePct: float | None = Field(default=None, ge=0, le=100)
    costVarianceIncreasePct: float | None = Field(default=None, ge=0, le=100)

    model_config = ConfigDict(from_attributes=True)


class SimulatorKpiSummary(BaseModel):
    highRiskSuppliers: int
    mediumRiskSuppliers: int
    lowRiskSuppliers: int
    avgOverallRisk: float
    avgOperationalRisk: float
    avgEsgRisk: float

    model_config = ConfigDict(from_attributes=True)


class SimulatorDeltaSummary(BaseModel):
    highRiskSuppliers: int
    mediumRiskSuppliers: int
    lowRiskSuppliers: int
    avgOverallRisk: float
    avgOperationalRisk: float
    avgEsgRisk: float

    model_config = ConfigDict(from_attributes=True)


class SimulatorRiskBandMovement(BaseModel):
    fromBand: str
    toBand: str
    supplierCount: int

    model_config = ConfigDict(from_attributes=True)


class SimulatorAffectedSupplierItem(BaseModel):
    supplierId: int
    supplierName: str
    country: str | None
    beforeOverallRisk: float
    afterOverallRisk: float
    deltaOverallRisk: float
    beforeRiskLevel: str
    afterRiskLevel: str
    impactReason: str

    model_config = ConfigDict(from_attributes=True)


class SimulatorScenarioMeta(BaseModel):
    scenarioType: ScenarioType
    title: str
    summary: str
    supplierId: int | None = None
    supplierName: str | None = None
    country: str | None = None
    severity: SupplierDisruptionSeverity | None = None
    targetType: OperationalTargetType | None = None
    targetValue: str | None = None
    delayIncreasePct: float | None = None
    defectIncreasePct: float | None = None
    costVarianceIncreasePct: float | None = None

    model_config = ConfigDict(from_attributes=True)


class SimulatorScenarioResponse(BaseModel):
    scenario: SimulatorScenarioMeta
    before: SimulatorKpiSummary
    after: SimulatorKpiSummary
    deltas: SimulatorDeltaSummary
    riskBandMovement: list[SimulatorRiskBandMovement]
    affectedSuppliers: list[SimulatorAffectedSupplierItem]

    model_config = ConfigDict(from_attributes=True)


class SimulatorOptionItem(BaseModel):
    label: str
    value: str

    model_config = ConfigDict(from_attributes=True)


class SimulatorOptionsResponse(BaseModel):
    countries: list[SimulatorOptionItem]
    commodities: list[SimulatorOptionItem]

    model_config = ConfigDict(from_attributes=True)
