from __future__ import annotations

from typing import Any


ALLOWED_AUDIT_DECISIONS = {
    "Monitor",
    "Pass",
    "Pass with conditions",
    "Corrective action required",
    "Escalate",
    "Suspend / Block",
}

ALLOWED_CONFIDENCE = {"low", "medium", "high"}

SUPPORTED_COUNTRIES = {
    "India",
    "Indonesia",
    "Brazil",
    "USA",
    "China",
    "Vietnam",
    "Germany",
    "Thailand",
    "Malaysia",
    "Singapore",
    "Philippines",
    "Mexico",
    "Netherlands",
    "France",
    "UK",
}

SUPPORTED_COMMODITIES = {"Palm Oil", "Cocoa", "Coffee", "Rubber", "Wood", "Soya"}

SUPPORTED_CERTIFICATIONS = {
    "RSPO",
    "Rainforest Alliance",
    "FSC",
    "PEFC",
    "Fairtrade",
    "ISO14001",
    "ISO22000",
    "GMP",
    "HACCP",
}


def _short_string(value: Any, fallback: str = "") -> str:
    if not isinstance(value, str):
        return fallback
    return value.strip()


def _string_list(value: Any, limit: int = 5) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        text = _short_string(item)
        if text:
            cleaned.append(text)
    return cleaned[:limit]


def validate_audit_insights(parsed: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    decision = _short_string(parsed.get("suggested_decision"), fallback["suggested_decision"])
    if decision not in ALLOWED_AUDIT_DECISIONS:
        decision = fallback["suggested_decision"]

    confidence = _short_string(parsed.get("confidence"), "medium").lower()
    if confidence not in ALLOWED_CONFIDENCE:
        confidence = "medium"

    return {
        "summary": _short_string(parsed.get("summary"), fallback["summary"]),
        "key_concerns": _string_list(parsed.get("key_concerns")) or fallback["key_concerns"],
        "reviewer_focus": _string_list(parsed.get("reviewer_focus")) or fallback["reviewer_focus"],
        "next_actions": _string_list(parsed.get("next_actions")) or fallback["next_actions"],
        "suggested_decision": decision,
        "confidence": confidence,
    }


def validate_onboarding_assistance(parsed: dict[str, Any]) -> dict[str, Any]:
    fields = parsed.get("suggestedFields") if isinstance(parsed.get("suggestedFields"), dict) else {}
    country = _short_string(fields.get("country")) or None
    if country not in SUPPORTED_COUNTRIES:
        country = None

    possible_countries = [
        value for value in _string_list(fields.get("possibleCountries"), limit=3)
        if value in SUPPORTED_COUNTRIES
    ]
    commodities = [
        value for value in _string_list(fields.get("commodities"))
        if value in SUPPORTED_COMMODITIES
    ]
    certifications = [
        value for value in _string_list(fields.get("certifications"))
        if value in SUPPORTED_CERTIFICATIONS
    ]
    confidence = _short_string(parsed.get("confidence"), "medium").lower()
    if confidence not in ALLOWED_CONFIDENCE:
        confidence = "medium"

    return {
        "summary": _short_string(
            parsed.get("summary"),
            "AI suggestions are available for the extracted data.",
        ),
        "canProceed": bool(parsed.get("canProceed", False)),
        "suggestedFields": {
            "supplier_name": _short_string(fields.get("supplier_name")) or None,
            "country": country,
            "possibleCountries": possible_countries,
            "commodities": commodities,
            "certifications": certifications,
        },
        "actions": _string_list(parsed.get("actions")),
        "confidence": confidence,
    }
