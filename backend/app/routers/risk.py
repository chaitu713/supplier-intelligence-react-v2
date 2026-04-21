from fastapi import APIRouter, Query

from ..schemas.risk import (
    DueDiligenceRequest,
    DueDiligenceResponse,
    RiskHistogramBin,
    RiskOverview,
    RiskSegmentationItem,
    RiskSupplierItem,
)
from ..services.risk_service import RiskService

router = APIRouter(prefix="/api/v1/risk", tags=["risk"])
risk_service = RiskService()


@router.get("/overview", response_model=RiskOverview)
def get_risk_overview() -> RiskOverview:
    return risk_service.get_risk_overview()


@router.get("/distribution", response_model=list[RiskHistogramBin])
def get_risk_distribution(bins: int = Query(default=7, ge=1, le=20)) -> list[RiskHistogramBin]:
    return risk_service.get_risk_distribution(bins=bins)


@router.get("/segmentation", response_model=list[RiskSegmentationItem])
def get_risk_segmentation() -> list[RiskSegmentationItem]:
    return risk_service.get_risk_segmentation()


@router.get("/top-suppliers", response_model=list[RiskSupplierItem])
def get_top_risk_suppliers(limit: int = Query(default=10, ge=1, le=50)) -> list[RiskSupplierItem]:
    return risk_service.get_top_risk_suppliers(limit=limit)


@router.post("/due-diligence", response_model=DueDiligenceResponse)
def run_due_diligence(payload: DueDiligenceRequest) -> DueDiligenceResponse:
    return risk_service.run_due_diligence(payload.supplierId)
