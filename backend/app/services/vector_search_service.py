from __future__ import annotations

import hashlib
import json
import math
import os
import re
from dataclasses import dataclass
from typing import Any

import pandas as pd

from ..ai.guardrails import GuardrailViolation, enforce_prompt_guardrails, sanitize_text_for_ai_context
from ..core.config import get_settings
from ..core.logging import get_logger
from . import database
from .dataset_service import DatasetService

logger = get_logger(__name__)


@dataclass(frozen=True)
class KnowledgeChunk:
    chunk_id: str
    source_type: str
    source_id: str
    title: str
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class KnowledgeSearchResult:
    chunk_id: str
    source_type: str
    source_id: str
    title: str
    text: str
    metadata: dict[str, Any]
    score: float
    score_type: str


class VectorSearchService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.dataset_service = DatasetService()

    def ensure_store(self) -> None:
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                chunk_id TEXT PRIMARY KEY,
                source_type TEXT,
                source_id TEXT,
                title TEXT,
                chunk_text TEXT,
                metadata TEXT,
                embedding_provider TEXT,
                embedding_model TEXT,
                embedding_json TEXT,
                content_hash TEXT,
                is_sanitized INTEGER,
                safety_notes TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        existing = database.column_names("knowledge_chunks")
        columns = {
            "is_sanitized": "INTEGER",
            "safety_notes": "TEXT",
        }
        for column, column_type in columns.items():
            if column not in existing:
                database.execute(f'ALTER TABLE knowledge_chunks ADD COLUMN "{column}" {column_type}')
        database.execute(
            'CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_source_type" ON "knowledge_chunks" ("source_type")'
        )
        database.execute(
            'CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_source_id" ON "knowledge_chunks" ("source_id")'
        )
        database.execute(
            'CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_content_hash" ON "knowledge_chunks" ("content_hash")'
        )

    def rebuild_index(self, limit: int | None = None) -> dict[str, Any]:
        self.ensure_store()
        chunks = self.build_chunks()
        if limit is not None:
            chunks = chunks[: max(0, limit)]

        provider = self.settings.rag_embedding_provider
        model = self._embedding_model_name()
        rows = []
        embedded = 0
        for chunk in chunks:
            safe_text, safety_notes = sanitize_text_for_ai_context(chunk.text)
            embedding = self._embed_text(safe_text)
            if embedding:
                embedded += 1
            rows.append(
                (
                    chunk.chunk_id,
                    chunk.source_type,
                    chunk.source_id,
                    chunk.title,
                    safe_text,
                    json.dumps(
                        {
                            **chunk.metadata,
                            "safety_notes": safety_notes,
                        },
                        default=str,
                    ),
                    provider,
                    model,
                    json.dumps(embedding) if embedding else None,
                    self._content_hash(safe_text),
                    1 if safety_notes else 0,
                    json.dumps(safety_notes),
                )
            )

        database.execute("DELETE FROM knowledge_chunks")
        if rows:
            database.execute_many(
                """
                INSERT INTO knowledge_chunks (
                    chunk_id,
                    source_type,
                    source_id,
                    title,
                    chunk_text,
                    metadata,
                    embedding_provider,
                    embedding_model,
                    embedding_json,
                    content_hash,
                    is_sanitized,
                    safety_notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )
        return {
            "indexedChunks": len(rows),
            "embeddedChunks": embedded,
            "embeddingProvider": provider,
            "embeddingModel": model,
        }

    def search(
        self,
        query: str,
        top_k: int | None = None,
        filters: dict[str, Any] | None = None,
    ) -> list[KnowledgeSearchResult]:
        guardrail_result = enforce_prompt_guardrails(
            message=query,
            feature="knowledge_search",
            required_context=False,
            context=filters or {},
        )
        if not guardrail_result.allowed:
            raise GuardrailViolation(guardrail_result)

        self.ensure_store()
        limit = top_k or self.settings.rag_top_k
        rows = database.fetch_all(
            """
            SELECT chunk_id, source_type, source_id, title, chunk_text, metadata, embedding_json
            FROM knowledge_chunks
            """
        )
        if not rows:
            return []

        filtered = [row for row in rows if self._matches_filters(row, filters or {})]
        query_embedding = self._embed_text(query)
        scored: list[KnowledgeSearchResult] = []
        for row in filtered:
            metadata = self._decode_metadata(row.get("metadata"))
            score_type = "lexical"
            score = self._lexical_score(
                query,
                str(row.get("chunk_text") or ""),
                str(row.get("title") or ""),
            )
            if query_embedding and row.get("embedding_json"):
                try:
                    embedding = json.loads(str(row["embedding_json"]))
                    vector_score = self._cosine_similarity(query_embedding, embedding)
                    if vector_score > 0:
                        score = vector_score
                        score_type = "vector"
                except Exception:
                    logger.debug("Failed to score vector chunk %s", row.get("chunk_id"))
            if score <= 0:
                continue
            scored.append(
                KnowledgeSearchResult(
                    chunk_id=str(row.get("chunk_id")),
                    source_type=str(row.get("source_type") or ""),
                    source_id=str(row.get("source_id") or ""),
                    title=str(row.get("title") or ""),
                    text=str(row.get("chunk_text") or ""),
                    metadata=metadata,
                    score=round(float(score), 4),
                    score_type=score_type,
                )
            )
        return sorted(scored, key=lambda item: item.score, reverse=True)[:limit]

    def build_chunks(self) -> list[KnowledgeChunk]:
        chunks: list[KnowledgeChunk] = []
        suppliers = self.dataset_service.load_suppliers_frame()
        risk_frame = self._safe_risk_frame()
        if not suppliers.empty:
            supplier_context = (
                suppliers.merge(risk_frame, on="supplier_id", how="left", suffixes=("", "_risk"))
                if not risk_frame.empty and "supplier_id" in risk_frame.columns
                else suppliers
            )
            for _, row in supplier_context.iterrows():
                chunks.append(self._supplier_chunk(row))

        chunks.extend(self._table_chunks("audits", "audit_id", "audit"))
        chunks.extend(self._table_chunks("supplier_certifications", "id", "certification"))
        chunks.extend(self._table_chunks("audit_capa", "capa_id", "audit_capa"))
        chunks.extend(self._table_chunks("audit_evidence", "audit_evidence_id", "audit_evidence"))
        chunks.extend(self._table_chunks("supplier_evidence", "evidence_id", "supplier_evidence"))
        chunks.extend(self._table_chunks("traceability_gap_actions", "gap_action_id", "traceability_gap"))
        chunks.extend(self._table_chunks("traceability_decisions", "decision_id", "traceability_decision"))
        chunks.extend(self._table_chunks("due_diligence_cases", "case_id", "due_diligence_case"))
        chunks.extend(self._table_chunks("monitoring_alerts", "alert_id", "monitoring_alert"))
        chunks.extend(self._table_chunks("external_esg_signals", "signal_id", "external_esg_signal"))
        return [chunk for chunk in chunks if chunk.text.strip()]

    def _safe_risk_frame(self) -> pd.DataFrame:
        try:
            from .risk_service import RiskService

            return RiskService()._build_supplier_risk_frame()
        except Exception as exc:
            logger.warning("RAG supplier risk enrichment unavailable: %s", exc)
            return pd.DataFrame()

    def _supplier_chunk(self, row: pd.Series) -> KnowledgeChunk:
        supplier_id = self._row_value(row, "supplier_id")
        name = self._row_value(row, "supplier_name") or f"Supplier {supplier_id}"
        fields = [
            ("Supplier", name),
            ("Country", self._row_value(row, "country")),
            ("Tier", self._row_value(row, "tier")),
            ("Category", self._row_value(row, "category")),
            ("Status", self._row_value(row, "status")),
            ("Overall risk", self._row_value(row, "overall_risk_score")),
            ("Operational risk", self._row_value(row, "operational_risk_score")),
            ("ESG risk", self._row_value(row, "esg_risk_score")),
            ("Evidence status", self._row_value(row, "evidence_status")),
            ("Traceability required", self._row_value(row, "traceability_required")),
            ("EUDR relevant", self._row_value(row, "eudr_relevant")),
        ]
        text = self._join_fields(fields)
        return KnowledgeChunk(
            chunk_id=self._chunk_id("supplier", supplier_id, text),
            source_type="supplier",
            source_id=str(supplier_id),
            title=f"Supplier profile: {name}",
            text=text,
            metadata={"supplier_id": self._safe_int(supplier_id), "supplier_name": name},
        )

    def _table_chunks(self, table_name: str, id_column: str, source_type: str) -> list[KnowledgeChunk]:
        try:
            if not database.table_exists(table_name):
                return []
            frame = database.read_table(table_name)
        except Exception as exc:
            logger.debug("Skipping RAG table %s: %s", table_name, exc)
            return []
        if frame.empty:
            return []

        chunks: list[KnowledgeChunk] = []
        for index, row in frame.iterrows():
            source_id = self._row_value(row, id_column) or self._row_value(row, "id") or str(index)
            supplier_id = self._row_value(row, "supplier_id")
            title = self._title_for_row(source_type, row, source_id)
            text = self._row_to_text(row)
            chunks.append(
                KnowledgeChunk(
                    chunk_id=self._chunk_id(source_type, source_id, text),
                    source_type=source_type,
                    source_id=str(source_id),
                    title=title,
                    text=text,
                    metadata={"supplier_id": self._safe_int(supplier_id), "table": table_name},
                )
            )
        return chunks

    def _title_for_row(self, source_type: str, row: pd.Series, source_id: object) -> str:
        supplier = self._row_value(row, "supplier_name") or self._row_value(row, "supplier_id")
        label = source_type.replace("_", " ").title()
        return f"{label}: {source_id}" + (f" for supplier {supplier}" if supplier else "")

    def _row_to_text(self, row: pd.Series) -> str:
        fields = []
        for column, value in row.items():
            if self._is_missing(value):
                continue
            text = str(value).strip()
            if text:
                fields.append((str(column).replace("_", " ").title(), text))
        return self._join_fields(fields)

    def _join_fields(self, fields: list[tuple[str, object]]) -> str:
        return "\n".join(f"{label}: {value}" for label, value in fields if value not in (None, ""))

    def _embed_text(self, text: str) -> list[float] | None:
        provider = self.settings.rag_embedding_provider
        if provider in {"", "none", "disabled"}:
            return None
        try:
            if provider == "openai":
                from openai import OpenAI

                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    return None
                client = OpenAI(api_key=api_key)
                response = client.embeddings.create(model=self.settings.rag_embedding_model, input=text[:8000])
                return list(response.data[0].embedding)
            if provider in {"azure", "azure_openai"}:
                from openai import AzureOpenAI

                endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
                api_key = os.getenv("AZURE_OPENAI_API_KEY")
                deployment = self.settings.azure_openai_embedding_deployment
                if not endpoint or not api_key or not deployment:
                    return None
                client = AzureOpenAI(
                    azure_endpoint=endpoint,
                    api_key=api_key,
                    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
                )
                response = client.embeddings.create(model=deployment, input=text[:8000])
                return list(response.data[0].embedding)
        except Exception as exc:
            logger.warning("Embedding generation failed; using lexical RAG fallback: %s", exc)
        return None

    def _embedding_model_name(self) -> str:
        if self.settings.rag_embedding_provider in {"azure", "azure_openai"}:
            return self.settings.azure_openai_embedding_deployment or ""
        return self.settings.rag_embedding_model

    def _lexical_score(self, query: str, text: str, title: str) -> float:
        query_terms = self._tokenize(query)
        if not query_terms:
            return 0.0
        haystack_terms = self._tokenize(f"{title} {text}")
        if not haystack_terms:
            return 0.0
        haystack = set(haystack_terms)
        overlap = sum(1 for term in query_terms if term in haystack)
        phrase_bonus = 0.15 if query.lower()[:80] in f"{title} {text}".lower() else 0.0
        return overlap / max(len(set(query_terms)), 1) + phrase_bonus

    def _tokenize(self, text: str) -> list[str]:
        stop_words = {"the", "and", "for", "with", "from", "that", "this", "are", "what", "which", "who", "how", "why"}
        return [
            token
            for token in re.findall(r"[a-z0-9]+", text.lower())
            if len(token) > 2 and token not in stop_words
        ]

    def _cosine_similarity(self, left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if not left_norm or not right_norm:
            return 0.0
        return dot / (left_norm * right_norm)

    def _matches_filters(self, row: dict[str, Any], filters: dict[str, Any]) -> bool:
        if not filters:
            return True
        metadata = self._decode_metadata(row.get("metadata"))
        if filters.get("source_type") and row.get("source_type") != filters["source_type"]:
            return False
        if filters.get("supplier_id") is not None and metadata.get("supplier_id") != int(filters["supplier_id"]):
            return False
        return True

    def _decode_metadata(self, value: object) -> dict[str, Any]:
        if not value:
            return {}
        try:
            payload = json.loads(str(value))
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _row_value(self, row: pd.Series, column: str) -> object:
        if column not in row:
            return None
        value = row.get(column)
        if self._is_missing(value):
            return None
        return value

    def _safe_int(self, value: object) -> int | None:
        try:
            if self._is_missing(value):
                return None
            return int(value)
        except Exception:
            return None

    def _is_missing(self, value: object) -> bool:
        if value is None:
            return True
        if isinstance(value, (list, tuple, dict, set)):
            return False
        try:
            return bool(pd.isna(value))
        except Exception:
            return False

    def _chunk_id(self, source_type: str, source_id: object, text: str) -> str:
        digest = hashlib.sha256(f"{source_type}:{source_id}:{text}".encode("utf-8")).hexdigest()[:24]
        return f"{source_type}_{digest}"

    def _content_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()


vector_search_service = VectorSearchService()
