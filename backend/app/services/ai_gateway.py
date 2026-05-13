from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass
from typing import Any

from ..ai.guardrails import (
    SAFE_BLOCK_MESSAGE,
    GuardrailResult,
    GuardrailViolation,
    enforce_prompt_guardrails,
    prompt_hash,
)
from .ai_audit_log import log_ai_event
from .ai_rate_limiter import check_ai_rate_limit
from ..observability.live_flow import emit_ai_event


class AiGatewayError(Exception):
    pass


@dataclass(frozen=True)
class AiTextRequest:
    feature: str
    prompt: str
    user_input: str
    context: dict[str, Any] | None = None
    response_format: str = "text"
    trace_id: str = ""


@dataclass(frozen=True)
class AiTextResponse:
    text: str
    provider: str
    model: str
    prompt_hash: str
    trace_id: str


def generate_ai_text(request: AiTextRequest) -> AiTextResponse:
    trace_id = request.trace_id or f"ai_{uuid.uuid4().hex[:16]}"
    emit_ai_event("ai.request_start", trace_id=trace_id, feature=request.feature)
    guardrail_result = enforce_prompt_guardrails(
        message=request.user_input or request.prompt,
        feature=request.feature,
        required_context=request.feature in {"advisor", "auditing", "onboarding", "traceability", "due_diligence"},
        context=request.context,
    )
    if not guardrail_result.allowed:
        emit_ai_event(
            "ai.guardrail_block",
            trace_id=trace_id,
            feature=request.feature,
            reason=guardrail_result.reason,
            layer=guardrail_result.layer,
        )
        log_ai_event(
            feature=request.feature,
            status="blocked",
            reason=guardrail_result.reason,
            prompt_hash=guardrail_result.prompt_hash,
            trace_id=trace_id,
            metadata={"layer": guardrail_result.layer},
        )
        raise GuardrailViolation(guardrail_result)
    emit_ai_event("ai.guardrail_pass", trace_id=trace_id, feature=request.feature, stage="user_input")

    # Run a second pass over the final prompt because uploaded documents can
    # contain prompt-injection text even when the explicit user input is clean.
    final_prompt_result = enforce_prompt_guardrails(
        message=request.prompt,
        feature=request.feature,
        context=request.context,
        include_domain_policy=False,
    )
    if not final_prompt_result.allowed:
        emit_ai_event(
            "ai.guardrail_block",
            trace_id=trace_id,
            feature=request.feature,
            reason=final_prompt_result.reason,
            layer=final_prompt_result.layer,
            source="final_prompt",
        )
        log_ai_event(
            feature=request.feature,
            status="blocked",
            reason=final_prompt_result.reason,
            prompt_hash=final_prompt_result.prompt_hash,
            trace_id=trace_id,
            metadata={"layer": final_prompt_result.layer, "source": "final_prompt"},
        )
        raise GuardrailViolation(final_prompt_result)
    emit_ai_event("ai.guardrail_pass", trace_id=trace_id, feature=request.feature, stage="final_prompt")

    rate_limit_key = f"{request.feature}:local"
    if not check_ai_rate_limit(rate_limit_key):
        rate_result = GuardrailResult(
            allowed=False,
            reason="rate_limit_exceeded",
            layer="layer_1_rate_limit",
            prompt_hash=guardrail_result.prompt_hash,
        )
        log_ai_event(
            feature=request.feature,
            status="blocked",
            reason=rate_result.reason,
            prompt_hash=rate_result.prompt_hash,
            trace_id=trace_id,
            metadata={"layer": rate_result.layer},
        )
        emit_ai_event("ai.rate_limit_block", trace_id=trace_id, feature=request.feature)
        raise GuardrailViolation(rate_result)

    provider = os.getenv("AI_PROVIDER", "gemini").strip().lower()
    started = time.perf_counter()
    try:
        emit_ai_event("ai.provider_start", trace_id=trace_id, feature=request.feature, provider=provider)
        if provider == "openai":
            text, model = _call_openai(request.prompt)
        elif provider in {"azure_openai", "azure"}:
            text, model = _call_azure_openai(request.prompt)
            provider = "azure_openai"
        else:
            text, model = _call_gemini(request.prompt)
            provider = "gemini"
    except GuardrailViolation:
        raise
    except Exception as exc:
        emit_ai_event(
            "ai.provider_error",
            trace_id=trace_id,
            feature=request.feature,
            provider=provider,
            reason=str(exc),
        )
        log_ai_event(
            feature=request.feature,
            status="provider_error",
            reason=str(exc),
            prompt_hash=prompt_hash(request.prompt),
            trace_id=trace_id,
            provider=provider,
        )
        raise AiGatewayError(str(exc)) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    emit_ai_event(
        "ai.provider_complete",
        trace_id=trace_id,
        feature=request.feature,
        provider=provider,
        model=model,
        latency_ms=latency_ms,
    )
    log_ai_event(
        feature=request.feature,
        status="passed",
        prompt_hash=prompt_hash(request.prompt),
        trace_id=trace_id,
        provider=provider,
        model=model,
    )
    return AiTextResponse(
        text=text or "",
        provider=provider,
        model=model,
        prompt_hash=prompt_hash(request.prompt),
        trace_id=trace_id,
    )


def blocked_message() -> str:
    return SAFE_BLOCK_MESSAGE


def _call_gemini(prompt: str) -> tuple[str, str]:
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=model, contents=prompt)
    return response.text or "", model


def _call_openai(prompt: str) -> tuple[str, str]:
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.3")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1024")),
    )
    return response.choices[0].message.content or "", model


def _call_azure_openai(prompt: str) -> tuple[str, str]:
    from openai import AzureOpenAI

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")
    if not endpoint or not api_key:
        raise RuntimeError("Azure OpenAI endpoint/key is not configured")
    client = AzureOpenAI(azure_endpoint=endpoint, api_key=api_key, api_version=api_version)
    response = client.chat.completions.create(
        model=deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.3")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1024")),
    )
    return response.choices[0].message.content or "", deployment
