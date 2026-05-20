from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from ..ai.guardrails import GuardrailViolation, safe_guardrail_message
from ..core.exceptions import AppError
from ..observability.live_flow import emit_ai_event
from ..schemas.knowledge import (
    KnowledgeRebuildRequest,
    KnowledgeRebuildResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeSource,
)
from ..security.auth import User
from ..security.rbac import require_role
from ..services.ai_audit_log import log_ai_event
from ..services.vector_search_service import vector_search_service

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


@router.post("/rebuild", response_model=KnowledgeRebuildResponse)
def rebuild_knowledge_index(
    payload: KnowledgeRebuildRequest,
    user: User = Depends(require_role("model_admin")),
) -> KnowledgeRebuildResponse:
    return KnowledgeRebuildResponse(**vector_search_service.rebuild_index(limit=payload.limit))


@router.post("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(
    payload: KnowledgeSearchRequest,
    user: User = Depends(require_role("ai_user")),
) -> KnowledgeSearchResponse:
    trace_id = f"ai_{uuid.uuid4().hex[:16]}"
    filters = {
        "source_type": payload.sourceType,
        "supplier_id": payload.supplierId,
    }
    try:
        results = vector_search_service.search(payload.query, top_k=payload.topK, filters=filters)
    except GuardrailViolation as exc:
        emit_ai_event(
            "ai.guardrail_block",
            trace_id=trace_id,
            feature="knowledge_search",
            reason=exc.result.reason,
            layer=exc.result.layer,
        )
        log_ai_event(
            feature="knowledge_search",
            status="blocked",
            reason=exc.result.reason,
            prompt_hash=exc.result.prompt_hash,
            trace_id=trace_id,
            metadata={"layer": exc.result.layer},
        )
        raise AppError(safe_guardrail_message(exc.result), status_code=400) from exc
    return KnowledgeSearchResponse(
        query=payload.query,
        results=[
            KnowledgeSource(
                chunkId=item.chunk_id,
                sourceType=item.source_type,
                sourceId=item.source_id,
                title=item.title,
                text=item.text,
                metadata=item.metadata,
                score=item.score,
                scoreType=item.score_type,
            )
            for item in results
        ],
    )
