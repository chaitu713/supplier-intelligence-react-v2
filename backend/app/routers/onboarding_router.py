from fastapi import APIRouter, UploadFile

from ..services.onboarding_service import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/upload")
async def upload_onboarding_document(file: UploadFile) -> dict:
    file_bytes = await file.read()
    data = onboarding_service.process_document(file_bytes)
    return {
        "message": "Upload successful",
        "data": data,
    }
