from pydantic import BaseModel, ConfigDict


class SupplierRecord(BaseModel):
    supplier_id: int
    supplier_name: str
    country: str | None = None
    parent_supplier_id: int | None = None
    category: str | None = None
    tier: str | None = None
    size: str | None = None
    annual_revenue: float | None = None
    dependency_score: float | None = None
    criticality_score: float | None = None
    onboarding_date: str | None = None
    status: str | None = None
    certification: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ESGRecord(BaseModel):
    supplier_id: int
    carbon_emission: float
    water_usage: float
    labor_violations: float
    land_use_risk: str | None = None
    esg_score: float

    model_config = ConfigDict(from_attributes=True)


class TransactionRecord(BaseModel):
    transaction_id: int
    supplier_id: int
    order_value: float
    delivery_delay_days: float
    defect_rate: float
    cost_variance: float

    model_config = ConfigDict(from_attributes=True)


class SupplierPerformanceRecord(BaseModel):
    supplier_id: int
    avg_delay: float
    avg_defect: float
    avg_cost_variance: float
    risk_score: float

    model_config = ConfigDict(from_attributes=True)
