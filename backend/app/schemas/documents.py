from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DocumentKind = Literal["supplier", "esg", "transaction"]
IngestionStatus = Literal["queued", "processing", "completed", "failed"]
StepStatus = Literal["pending", "processing", "completed", "failed"]
UploadMethod = Literal["PUT", "POST"]


class UploadUrlRequest(BaseModel):
    fileName: str = Field(min_length=1)
    documentKind: DocumentKind
    contentType: str = Field(min_length=1)


class UploadUrlResponse(BaseModel):
    fileName: str
    documentKind: DocumentKind
    blobKey: str
    uploadUrl: str
    uploadMethod: UploadMethod
    headers: dict[str, str] | None = None

    model_config = ConfigDict(from_attributes=True)


class IngestionCreateFile(BaseModel):
    fileName: str = Field(min_length=1)
    documentKind: DocumentKind
    blobKey: str = Field(min_length=1)


class IngestionCreateRequest(BaseModel):
    files: list[IngestionCreateFile] = Field(min_length=1)


class IngestionStep(BaseModel):
    name: Literal["upload", "extract", "parse", "persist", "history"]
    status: StepStatus
    message: str | None = None


class IngestionSummary(BaseModel):
    supplierRecordsAdded: int
    esgRecordsAdded: int
    transactionRecordsAdded: int


class IngestionJobResponse(BaseModel):
    jobId: str
    status: IngestionStatus
    createdAt: datetime
    updatedAt: datetime
    steps: list[IngestionStep]
    summary: IngestionSummary | None = None


class DocumentHistoryItem(BaseModel):
    documentName: str
    documentType: str
    status: str
    recordsAdded: str
    timestamp: str
