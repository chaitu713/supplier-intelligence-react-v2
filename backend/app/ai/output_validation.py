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
ALLOWED_AUDIT_RECOMMENDATIONS = {
    "Pass",
    "Pass with Conditions",
    "Corrective Action Required",
    "Escalate",
    "Suspend / Block",
}

ALLOWED_TRACE_DECISIONS = {
    "Trace Complete",
    "Trace Complete with Conditions",
    "Evidence Gap",
    "High-Risk Trace",
    "Block / Escalate",
}

ALLOWED_ONBOARDING_DECISIONS = {
    "Draft",
    "Evidence Requested",
    "Evidence Under Review",
    "Ready for Approval",
    "Approved",
    "Approved With Conditions",
    "Approve",
    "Approve with Conditions",
    "Needs More Evidence",
    "Reject",
    "Rejected",
    "Escalate",
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


def _bounded_string(value: Any, fallback: str = "", limit: int = 1200) -> str:
    text = _short_string(value, fallback)
    return text[:limit]


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


def validate_audit_decision(parsed: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    recommendation = _short_string(parsed.get("recommendation"), fallback["recommendation"])
    if recommendation not in ALLOWED_AUDIT_RECOMMENDATIONS:
        recommendation = fallback["recommendation"]

    confidence = _short_string(parsed.get("confidence"), fallback.get("confidence", "medium")).lower()
    if confidence not in ALLOWED_CONFIDENCE:
        confidence = fallback.get("confidence", "medium")

    return {
        "recommendation": recommendation,
        "confidence": confidence,
        "reasons": _string_list(parsed.get("reasons")) or fallback["reasons"],
        "required_actions": _string_list(parsed.get("required_actions")) or fallback["required_actions"],
        "closure_blockers": _string_list(parsed.get("closure_blockers")) or fallback["closure_blockers"],
        "source": fallback.get("source", "deterministic_fallback"),
        "provider": fallback.get("provider"),
        "model": fallback.get("model"),
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


def validate_onboarding_decision(parsed: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    decision = _short_string(parsed.get("decision"), fallback.get("decision", "Needs More Evidence"))
    if decision not in ALLOWED_ONBOARDING_DECISIONS:
        decision = fallback.get("decision", "Needs More Evidence")

    confidence = _short_string(parsed.get("confidence"), fallback.get("confidence", "Medium")).lower()
    if confidence not in ALLOWED_CONFIDENCE:
        confidence = str(fallback.get("confidence", "Medium")).lower()

    blockers = _string_list(parsed.get("blockers")) or fallback.get("blockers", [])
    conditions = _string_list(parsed.get("conditions")) or fallback.get("conditions", [])

    if decision == "Approve" and blockers:
        decision = "Approve with Conditions"

    return {
        "decision": decision,
        "confidence": confidence.title(),
        "summary": _bounded_string(parsed.get("summary"), fallback.get("summary", "")),
        "rationale": _string_list(parsed.get("rationale")) or fallback.get("rationale", []),
        "blockers": blockers,
        "conditions": conditions,
        "next_actions": _string_list(parsed.get("next_actions")) or fallback.get("next_actions", []),
        "source": fallback.get("source", "deterministic_fallback"),
        "provider": fallback.get("provider"),
        "model": fallback.get("model"),
    }


def validate_trace_decision(parsed: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    decision = _short_string(parsed.get("decision"), fallback["decision"])
    if decision not in ALLOWED_TRACE_DECISIONS:
        decision = fallback["decision"]

    confidence = _short_string(parsed.get("confidence"), fallback.get("confidence", "medium")).lower()
    if confidence not in ALLOWED_CONFIDENCE:
        confidence = fallback.get("confidence", "medium")

    blockers = _string_list(parsed.get("blockers")) or fallback.get("blockers", [])
    missing_evidence = _string_list(parsed.get("missingEvidence")) or fallback.get("missingEvidence", [])
    if decision == "Trace Complete" and (blockers or missing_evidence):
        decision = "Trace Complete with Conditions"

    return {
        "decision": decision,
        "confidence": confidence,
        "rationale": _string_list(parsed.get("rationale")) or fallback["rationale"],
        "blockers": blockers,
        "missingEvidence": missing_evidence,
        "nextActions": _string_list(parsed.get("nextActions")) or fallback["nextActions"],
        "source": fallback.get("source", "deterministic_fallback"),
        "provider": fallback.get("provider"),
        "model": fallback.get("model"),
    }


def validate_due_diligence_summary(text: Any, fallback: str) -> str:
    summary = _bounded_string(text, fallback, limit=1800)
    if not summary:
        return fallback
    required_signals = ("supplier", "risk", "review")
    lowered = summary.lower()
    if not any(signal in lowered for signal in required_signals):
        return fallback
    return summary
