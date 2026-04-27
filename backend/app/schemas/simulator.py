from pydantic import BaseModel, ConfigDict, Field


class SupplierDisruptionScenarioRequest(BaseModel):
    scenarioType: str = "supplier_disruption"
    supplierId: int = Field(gt=0)
    severity: str

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


class SupplierDisruptionScenarioMeta(BaseModel):
    scenarioType: str
    severity: str
    supplierId: int
    supplierName: str
    country: str | None

    model_config = ConfigDict(from_attributes=True)


class SupplierDisruptionScenarioResponse(BaseModel):
    scenario: SupplierDisruptionScenarioMeta
    before: SimulatorKpiSummary
    after: SimulatorKpiSummary
    deltas: SimulatorDeltaSummary
    riskBandMovement: list[SimulatorRiskBandMovement]
    affectedSuppliers: list[SimulatorAffectedSupplierItem]

    model_config = ConfigDict(from_attributes=True)
