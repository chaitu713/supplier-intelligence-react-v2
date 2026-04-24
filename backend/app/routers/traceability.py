from fastapi import APIRouter

from ..services.traceability_service import traceability_service

router = APIRouter(prefix="/traceability", tags=["traceability"])


@router.get("/workspace")
def get_traceability_workspace() -> dict:
    return traceability_service.get_workspace_data()
