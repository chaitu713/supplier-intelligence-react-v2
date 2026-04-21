from fastapi import APIRouter

from ..schemas.common import APIMessage

router = APIRouter(tags=["health"])


@router.get("/", response_model=APIMessage)
def home() -> APIMessage:
    return APIMessage(message="Supplier AI Intelligence API running")
