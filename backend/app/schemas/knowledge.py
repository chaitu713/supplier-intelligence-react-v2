from __future__ import annotations

from pydantic import BaseModel, Field


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    topK: int = Field(default=5, ge=1, le=20)
    sourceType: str | None = None
    supplierId: int | None = None


class KnowledgeSource(BaseModel):
    chunkId: str
    sourceType: str
    sourceId: str
    title: str
    text: str
    metadata: dict
    score: float
    scoreType: str


class KnowledgeSearchResponse(BaseModel):
    query: str
    results: list[KnowledgeSource]


class KnowledgeRebuildRequest(BaseModel):
    limit: int | None = Field(default=None, ge=1, le=10000)


class KnowledgeRebuildResponse(BaseModel):
    indexedChunks: int
    embeddedChunks: int
    embeddingProvider: str
    embeddingModel: str
