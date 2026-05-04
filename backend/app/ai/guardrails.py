from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


SAFE_BLOCK_MESSAGE = "This request could not be processed because it conflicts with AI safety rules."


@dataclass(frozen=True)
class GuardrailResult:
    allowed: bool
    reason: str = ""
    layer: str = ""
    prompt_hash: str = ""


class GuardrailViolation(Exception):
    def __init__(self, result: GuardrailResult) -> None:
        super().__init__(result.reason or SAFE_BLOCK_MESSAGE)
        self.result = result


INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"reveal\s+(the\s+)?(system|developer|hidden)\s+prompt",
    r"show\s+(me\s+)?(the\s+)?(system|developer|hidden)\s+prompt",
    r"you\s+are\s+now\s+",
    r"(new|updated)\s+system\s+prompt",
    r"developer\s+mode",
    r"jailbreak",
    r"\bDAN\s*mode\b",
    r"<\s*script\b",
    r"(--|;|')\s*(drop|select|insert|update|delete)\s+",
    r"\b(no\s+rules|no\s+restrictions|unfiltered|uncensored)\b",
    r"\b(roleplay|simulate)\b.+\b(no\s+policy|no\s+guardrails|no\s+safety)\b",
]

SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9_\-]{20,}",
    r"AIza[0-9A-Za-z\-_]{35}",
    r"-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY",
    r"\bBearer\s+[A-Za-z0-9\-._~+/]+=*",
    r"\b(api[_-]?key|password|client[_-]?secret|access[_-]?token)\s*[=:]\s*\S{8,}",
]

SUPPLIER_POLICY_PATTERNS = [
    r"\b(mark|set|make)\b.+\b(compliant|approved|verified|low\s+risk)\b.+\b(without|no)\b.+\b(evidence|review|audit)\b",
    r"\b(invent|fabricate|make\s+up|create\s+fake)\b.+\b(supplier|certification|certificate|audit|esg|risk\s+score|evidence)\b",
    r"\b(bypass|skip|override)\b.+\b(audit|approval|review|control|guardrail|validation)\b",
    r"\bmodify\b.+\b(csv|dataset|supplier\s+record|audit\s+record)\b.+\bwithout\b.+\b(approval|review)\b",
    r"\b(delete|alter|overwrite)\b.+\b(csv|dataset|supplier\s+record|audit\s+record)\b",
    r"\b(final|definitive|legally\s+binding)\b.+\b(procurement|compliance|audit|legal)\b.+\b(decision|approval|clearance)\b",
    r"\b(recommend|select|choose)\b.+\b(alternate|replacement)\s+supplier\b.+\bwithout\b.+\b(ranking|criteria|data|evidence)\b",
    r"\bcertify\b.+\b(no|without)\b.+\b(document|certificate|evidence|audit)\b",
    r"\bchange\b.+\b(risk\s+score|esg\s+score|audit\s+score)\b.+\b(manually|without)\b",
]

MAX_PROMPT_CHARS = 20000


def prompt_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def enforce_prompt_guardrails(
    *,
    message: str,
    feature: str,
    required_context: bool = False,
    context: dict | None = None,
    include_domain_policy: bool = True,
) -> GuardrailResult:
    text = (message or "").strip()
    current_hash = prompt_hash(text)

    if not text:
        return GuardrailResult(False, "empty_message", "layer_1_structural", current_hash)

    if len(text) > MAX_PROMPT_CHARS:
        return GuardrailResult(False, "message_too_large", "layer_1_structural", current_hash)

    if required_context and not context:
        return GuardrailResult(False, "missing_grounding_context", "layer_1_structural", current_hash)

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return GuardrailResult(False, "injection_detected", "layer_2_injection", current_hash)

    for pattern in SECRET_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return GuardrailResult(False, "secret_detected", "layer_3_secrets", current_hash)

    if include_domain_policy:
        for pattern in SUPPLIER_POLICY_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
                return GuardrailResult(False, "supplier_policy_violation", "layer_4_domain", current_hash)

    return GuardrailResult(True, prompt_hash=current_hash)


def raise_if_blocked(result: GuardrailResult) -> None:
    if not result.allowed:
        raise GuardrailViolation(result)
