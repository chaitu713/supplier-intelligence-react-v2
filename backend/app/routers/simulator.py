from fastapi import APIRouter

from ..schemas.simulator import (
    SupplierDisruptionScenarioRequest,
    SupplierDisruptionScenarioResponse,
)
from ..services.simulator_service import SimulatorService

router = APIRouter(prefix="/api/v1/simulator", tags=["simulator"])
simulator_service = SimulatorService()


@router.post("/run", response_model=SupplierDisruptionScenarioResponse)
def run_supplier_disruption(
    payload: SupplierDisruptionScenarioRequest,
) -> SupplierDisruptionScenarioResponse:
    return simulator_service.run_supplier_disruption(payload.supplierId, payload.severity)
