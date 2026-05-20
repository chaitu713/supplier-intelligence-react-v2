from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import re
import uuid

from azure.storage.blob import BlobServiceClient

from ..core.config import get_settings


@dataclass(frozen=True)
class BlobUploadResult:
    blob_name: str
    blob_url: str


class BlobStorageService:
    def __init__(self) -> None:
        self._client: BlobServiceClient | None = None

    def is_configured(self) -> bool:
        return bool(get_settings().blob_connection_string)

    def upload_bytes(
        self,
        *,
        data: bytes,
        file_name: str,
        prefix: str,
        blob_name: str | None = None,
    ) -> BlobUploadResult | None:
        if not data or not self.is_configured():
            return None

        settings = get_settings()
        blob_name = self._safe_blob_name(blob_name) if blob_name else self._build_blob_name(prefix, file_name)
        blob_client = self._get_client().get_blob_client(
            container=settings.blob_container_name,
            blob=blob_name,
        )
        blob_client.upload_blob(data, overwrite=True)
        return BlobUploadResult(blob_name=blob_name, blob_url=blob_client.url)

    def _get_client(self) -> BlobServiceClient:
        if self._client is None:
            connection_string = get_settings().blob_connection_string
            if not connection_string:
                raise RuntimeError("Blob storage is not configured")
            self._client = BlobServiceClient.from_connection_string(connection_string)
        return self._client

    def _build_blob_name(self, prefix: str, file_name: str) -> str:
        safe_prefix = self._safe_path_part(prefix).strip("/") or "evidence"
        safe_name = self._safe_path_part(Path(file_name).name) or "evidence_file"
        timestamp = datetime.now(timezone.utc).strftime("%Y/%m/%d/%H%M%S")
        return f"{safe_prefix}/{timestamp}-{uuid.uuid4().hex}-{safe_name}"

    def _safe_blob_name(self, value: str) -> str:
        return self._safe_path_part(value) or f"evidence/{uuid.uuid4().hex}"

    def _safe_path_part(self, value: str) -> str:
        return re.sub(r"[^A-Za-z0-9_.\-/]+", "_", value).strip("._/")


blob_storage_service = BlobStorageService()
