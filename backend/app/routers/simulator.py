from fastapi import APIRouter

from ..schemas.simulator import (
    SimulatorOptionsResponse,
    SimulatorScenarioRequest,
    SimulatorScenarioResponse,
)
from ..services.simulator_service import SimulatorService

router = APIRouter(prefix="/api/v1/simulator", tags=["simulator"])
simulator_service = SimulatorService()


@router.get("/options", response_model=SimulatorOptionsResponse)
def get_simulator_options() -> SimulatorOptionsResponse:
    return simulator_service.get_options()


@router.post("/run", response_model=SimulatorScenarioResponse)
def run_simulation(
    payload: SimulatorScenarioRequest,
) -> SimulatorScenarioResponse:
    return simulator_service.run_simulation(payload)
