from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PromptDefinition:
    name: str
    version: str
    owner: str
    expected_format: str
    rules: tuple[str, ...]


COMMON_SUPPLIER_AI_RULES = (
    "Use only the supplied grounding context.",
    "Do not invent suppliers, certifications, audit findings, ESG evidence, or risk scores.",
    "Do not present AI output as a final procurement, legal, compliance, or audit decision.",
    "If the available context is insufficient, say what is missing instead of guessing.",
    "Keep recommendations advisory and suitable for human review.",
)


PROMPT_REGISTRY: dict[str, PromptDefinition] = {
    "advisor": PromptDefinition(
        name="supplier_advisor",
        version="2026-04-30",
        owner="supplier-intelligence",
        expected_format="plain_text",
        rules=COMMON_SUPPLIER_AI_RULES
        + (
            "Use the deterministic brief as the primary structure.",
            "Mention specific suppliers, countries, commodities, or KPI deltas only when present in context.",
        ),
    ),
    "auditing": PromptDefinition(
        name="audit_insights",
        version="2026-04-30",
        owner="supplier-intelligence",
        expected_format="strict_json",
        rules=COMMON_SUPPLIER_AI_RULES
        + (
            "Suggested decision must be one of the allowed audit decision values.",
            "Never close, approve, or reject an audit on behalf of the reviewer.",
        ),
    ),
    "onboarding": PromptDefinition(
        name="onboarding_remediation",
        version="2026-04-30",
        owner="supplier-intelligence",
        expected_format="strict_json",
        rules=COMMON_SUPPLIER_AI_RULES
        + (
            "Suggest only supported countries, commodities, and certifications.",
            "Do not create or modify supplier records directly.",
        ),
    ),
    "due_diligence": PromptDefinition(
        name="due_diligence_summary",
        version="2026-04-30",
        owner="supplier-intelligence",
        expected_format="plain_text",
        rules=COMMON_SUPPLIER_AI_RULES
        + (
            "Focus on risk drivers, evidence gaps, and next review actions.",
            "Make clear that the result supports human due diligence review.",
        ),
    ),
    "traceability": PromptDefinition(
        name="traceability_decision",
        version="2026-05-05",
        owner="supplier-intelligence",
        expected_format="strict_json",
        rules=COMMON_SUPPLIER_AI_RULES
        + (
            "Trace decision must be one of the allowed trace decision values.",
            "Never mark a trace complete when open high-severity evidence gaps remain.",
            "Keep EUDR readiness recommendations advisory and suitable for human review.",
        ),
    ),
}


def get_prompt_definition(feature: str) -> PromptDefinition:
    return PROMPT_REGISTRY.get(feature, PROMPT_REGISTRY["advisor"])


def get_prompt_policy_block(feature: str) -> str:
    definition = get_prompt_definition(feature)
    rules = "\n".join(f"- {rule}" for rule in definition.rules)
    return (
        f"Prompt name: {definition.name}\n"
        f"Prompt version: {definition.version}\n"
        f"Expected output format: {definition.expected_format}\n"
        "Controlled AI rules:\n"
        f"{rules}"
    )
