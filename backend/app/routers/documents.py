from fastapi import APIRouter, Request, Response, status

from ..schemas.documents import (
    DocumentHistoryItem,
    IngestionCreateRequest,
    IngestionJobResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from ..services.document_service import document_service

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.post("/upload-url", response_model=UploadUrlResponse)
def create_upload_url(payload: UploadUrlRequest, request: Request) -> UploadUrlResponse:
    return document_service.create_upload_url(payload, str(request.base_url))


@router.put("/uploads/{blob_key}", status_code=status.HTTP_204_NO_CONTENT)
async def upload_document(blob_key: str, request: Request) -> Response:
    file_bytes = await request.body()
    document_service.store_uploaded_file(blob_key, file_bytes)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/ingestions", response_model=IngestionJobResponse)
def create_ingestion_job(payload: IngestionCreateRequest) -> IngestionJobResponse:
    return document_service.create_ingestion_job(payload)


@router.get("/ingestions/{job_id}", response_model=IngestionJobResponse)
def get_ingestion_job(job_id: str) -> IngestionJobResponse:
    return document_service.get_ingestion_job(job_id)


@router.get("/history", response_model=list[DocumentHistoryItem])
def get_document_history() -> list[DocumentHistoryItem]:
    return document_service.get_document_history()
