from fastapi import APIRouter

from ..schemas.esg_monitoring import EsgMonitoringOverview
from ..services.esg_monitoring_service import EsgMonitoringService

router = APIRouter(prefix="/api/v1/esg-monitoring", tags=["esg-monitoring"])
esg_monitoring_service = EsgMonitoringService()


@router.get("/overview", response_model=EsgMonitoringOverview)
def get_esg_monitoring_overview() -> EsgMonitoringOverview:
    return esg_monitoring_service.get_overview()
