from __future__ import annotations

import threading
from datetime import datetime, UTC
from pathlib import Path
from typing import Any
from uuid import uuid4

import pandas as pd

from ..core.config import get_settings
from ..core.exceptions import AppError
from ..core.logging import get_logger
from ..schemas.documents import (
    DocumentHistoryItem,
    IngestionCreateRequest,
    IngestionJobResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class DocumentService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create_upload_url(self, payload: UploadUrlRequest, base_url: str) -> UploadUrlResponse:
        self.settings.uploads_dir.mkdir(parents=True, exist_ok=True)

        safe_name = Path(payload.fileName).name
        if not safe_name.lower().endswith(".pdf"):
            raise AppError("Only PDF documents are supported", status_code=400)

        blob_key = f"{uuid4().hex}_{safe_name}"
        upload_url = f"{base_url.rstrip('/')}/api/v1/documents/uploads/{blob_key}"

        logger.info(
            "Created upload slot for %s document: %s",
            payload.documentKind,
            safe_name,
        )

        return UploadUrlResponse(
            fileName=safe_name,
            documentKind=payload.documentKind,
            blobKey=blob_key,
            uploadUrl=upload_url,
            uploadMethod="PUT",
            headers=None,
        )

    def store_uploaded_file(self, blob_key: str, file_bytes: bytes) -> None:
        if not file_bytes:
            raise AppError("Uploaded file is empty", status_code=400)

        destination = self._uploaded_file_path(blob_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(file_bytes)

        logger.info("Stored uploaded file at %s", destination)

    def create_ingestion_job(self, payload: IngestionCreateRequest) -> IngestionJobResponse:
        if len(payload.files) != 3:
            raise AppError(
                "Exactly three files are required: supplier, esg, and transaction",
                status_code=400,
            )

        kinds = {item.documentKind for item in payload.files}
        if kinds != {"supplier", "esg", "transaction"}:
            raise AppError(
                "Document set must include supplier, esg, and transaction files",
                status_code=400,
            )

        for item in payload.files:
            if not self._uploaded_file_path(item.blobKey).exists():
                raise AppError(f"Uploaded file not found for blob key {item.blobKey}", status_code=404)

        job_id = f"ing_{uuid4().hex[:12]}"
        now = _utcnow()
        job = {
            "jobId": job_id,
            "status": "queued",
            "createdAt": now,
            "updatedAt": now,
            "steps": [
                {"name": "upload", "status": "completed", "message": "All files uploaded"},
                {"name": "extract", "status": "pending", "message": None},
                {"name": "parse", "status": "pending", "message": None},
                {"name": "persist", "status": "pending", "message": None},
                {"name": "history", "status": "pending", "message": None},
            ],
            "summary": None,
            "files": [item.model_dump() for item in payload.files],
        }

        with self._lock:
            self._jobs[job_id] = job

        thread = threading.Thread(
            target=self._run_ingestion_job,
            args=(job_id,),
            daemon=True,
        )
        thread.start()

        logger.info("Created ingestion job %s", job_id)
        return self.get_ingestion_job(job_id)

    def get_ingestion_job(self, job_id: str) -> IngestionJobResponse:
        with self._lock:
            job = self._jobs.get(job_id)

        if not job:
            raise AppError("Ingestion job not found", status_code=404)

        return IngestionJobResponse.model_validate(job)

    def get_document_history(self) -> list[DocumentHistoryItem]:
        history_file = self.settings.document_history_file
        if not history_file.exists():
            logger.info("Document history file not found, returning empty history")
            return []

        history = pd.read_csv(history_file)
        if history.empty:
            return []

        history = history.sort_values("timestamp", ascending=False).reset_index(drop=True)

        items = [
            DocumentHistoryItem(
                documentName=str(row["document_name"]),
                documentType=str(row["document_type"]),
                status=str(row["status"]),
                recordsAdded=str(row["records_added"]),
                timestamp=str(row["timestamp"]),
            )
            for _, row in history.iterrows()
        ]
        return items

    def _uploaded_file_path(self, blob_key: str) -> Path:
        safe_key = Path(blob_key).name
        return self.settings.uploads_dir / safe_key

    def _load_legacy_integrations(self):
        try:
            from backend.blob_storage import upload_file_to_blob
            from backend.data_append import process_extracted_document
            from backend.document_history import log_document
            from backend.document_intelligence import extract_document
        except ImportError:
            from blob_storage import upload_file_to_blob
            from data_append import process_extracted_document
            from document_history import log_document
            from document_intelligence import extract_document

        return upload_file_to_blob, extract_document, process_extracted_document, log_document

    def _run_ingestion_job(self, job_id: str) -> None:
        try:
            upload_file_to_blob, extract_document, process_extracted_document, log_document = (
                self._load_legacy_integrations()
            )

            self._set_job_status(job_id, "processing")
            self._update_step(job_id, "extract", "processing", "Uploading files to blob storage")

            with self._lock:
                files = list(self._jobs[job_id]["files"])

            extracted_documents: list[dict[str, str]] = []
            for file_info in files:
                local_path = self._uploaded_file_path(file_info["blobKey"])
                blob_url = upload_file_to_blob(str(local_path), file_info["fileName"])
                extracted_text = extract_document(blob_url)
                extracted_documents.append(
                    {
                        "fileName": file_info["fileName"],
                        "documentKind": file_info["documentKind"],
                        "text": extracted_text,
                    }
                )

            self._update_step(job_id, "extract", "completed", "Document extraction completed")
            self._update_step(job_id, "parse", "processing", "Parsing extracted text")

            summary = {
                "supplierRecordsAdded": 0,
                "esgRecordsAdded": 0,
                "transactionRecordsAdded": 0,
            }

            processed_documents: list[dict[str, str]] = []
            for document in extracted_documents:
                doc_type, count_message = process_extracted_document(document["text"])
                processed_documents.append(
                    {
                        "fileName": document["fileName"],
                        "documentType": doc_type,
                        "recordsAdded": str(count_message),
                    }
                )

                count_value = self._extract_count(count_message)
                if doc_type == "supplier":
                    summary["supplierRecordsAdded"] = count_value
                elif doc_type == "esg":
                    summary["esgRecordsAdded"] = count_value
                elif doc_type == "transaction":
                    summary["transactionRecordsAdded"] = count_value

            self._update_step(job_id, "parse", "completed", "Parsing completed")
            self._update_step(job_id, "persist", "completed", "Datasets updated successfully")
            self._update_step(job_id, "history", "processing", "Writing document history")

            for document in processed_documents:
                log_document(
                    document["fileName"],
                    document["documentType"],
                    document["recordsAdded"],
                )

            self._set_summary(job_id, summary)
            self._update_step(job_id, "history", "completed", "History logged")
            self._set_job_status(job_id, "completed")
            logger.info("Completed ingestion job %s", job_id)
        except Exception as exc:
            logger.exception("Ingestion job %s failed", job_id, exc_info=exc)
            self._mark_job_failed(job_id, str(exc))

    def _extract_count(self, count_message: str | int) -> int:
        if isinstance(count_message, int):
            return count_message

        text = str(count_message).strip()
        if not text:
            return 0

        first_token = text.split()[0]
        try:
            return int(first_token)
        except ValueError:
            return 0

    def _set_job_status(self, job_id: str, status: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job["status"] = status
            job["updatedAt"] = _utcnow()

    def _set_summary(self, job_id: str, summary: dict[str, int]) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job["summary"] = summary
            job["updatedAt"] = _utcnow()

    def _update_step(self, job_id: str, step_name: str, status: str, message: str | None) -> None:
        with self._lock:
            job = self._jobs[job_id]
            for step in job["steps"]:
                if step["name"] == step_name:
                    step["status"] = status
                    step["message"] = message
                    break
            job["updatedAt"] = _utcnow()

    def _mark_job_failed(self, job_id: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return

            job["status"] = "failed"
            job["updatedAt"] = _utcnow()

            for step in reversed(job["steps"]):
                if step["status"] == "processing":
                    step["status"] = "failed"
                    step["message"] = message
                    break
            else:
                job["steps"][-1]["status"] = "failed"
                job["steps"][-1]["message"] = message


document_service = DocumentService()
