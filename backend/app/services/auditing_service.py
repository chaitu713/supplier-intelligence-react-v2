from __future__ import annotations

import json
import os
import re
from datetime import date
from pathlib import Path

import pandas as pd
from google import genai

from ..core.exceptions import AppError
from .onboarding_service import onboarding_service


class AuditingService:
    def __init__(self) -> None:
        self.data_dir = Path(__file__).resolve().parents[3] / "data"
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

    def get_audit_insights(self, audit_id: int) -> dict:
        context = self._load_audit_context(audit_id)
        fallback = self._build_fallback_insights(context)

        if not self.gemini_client:
            return fallback

        prompt = f"""
You are helping with AI-assisted supplier auditing.

Audit context:
{json.dumps(context, indent=2)}

Return strict JSON with this shape:
{{
  "summary": "short paragraph",
  "key_concerns": ["concern 1", "concern 2"],
  "reviewer_focus": ["focus 1", "focus 2"],
  "next_actions": ["action 1", "action 2"],
  "suggested_decision": "Monitor | Pass with conditions | Corrective action required | Escalate",
  "confidence": "low|medium|high"
}}

Rules:
- Stay grounded in the supplied audit context only.
- Do not invent regulations, evidence, or findings not present or reasonably inferable from the context.
- Keep every list short and practical.
- Suggested decision must be one of the provided options.
"""
        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                contents=prompt,
            )
            parsed = json.loads(self._extract_json_block((response.text or "").strip()))
            if not isinstance(parsed, dict):
                return fallback

            return {
                "summary": parsed.get("summary") or fallback["summary"],
                "key_concerns": parsed.get("key_concerns") or fallback["key_concerns"],
                "reviewer_focus": parsed.get("reviewer_focus") or fallback["reviewer_focus"],
                "next_actions": parsed.get("next_actions") or fallback["next_actions"],
                "suggested_decision": parsed.get("suggested_decision")
                or fallback["suggested_decision"],
                "confidence": parsed.get("confidence") or "medium",
            }
        except Exception:
            return fallback

    def update_supplier_certification(
        self,
        supplier_id: int,
        cert_name: str,
        issue_date: str,
        expiry_date: str,
        status: str,
    ) -> dict:
        supplier_certs_path = self.data_dir / "supplier_certifications_v2.csv"
        certs_path = self.data_dir / "certifications_v2.csv"

        supplier_certs_df = pd.read_csv(supplier_certs_path)
        certs_df = pd.read_csv(certs_path)

        cert_match = certs_df[certs_df["cert_name"].astype(str).str.casefold() == cert_name.casefold()]
        if cert_match.empty:
            raise AppError("Certification not found", status_code=404)

        cert_id = int(cert_match.iloc[0]["cert_id"])
        row_match = supplier_certs_df[
            (supplier_certs_df["supplier_id"] == supplier_id) & (supplier_certs_df["cert_id"] == cert_id)
        ]
        if row_match.empty:
            raise AppError("Supplier certification mapping not found", status_code=404)

        row_index = row_match.index[0]
        supplier_certs_df.at[row_index, "issue_date"] = issue_date
        supplier_certs_df.at[row_index, "expiry_date"] = expiry_date
        supplier_certs_df.at[row_index, "status"] = status
        supplier_certs_df.to_csv(supplier_certs_path, index=False)

        return {
            "supplier_id": supplier_id,
            "cert_name": cert_match.iloc[0]["cert_name"],
            "issue_date": issue_date,
            "expiry_date": expiry_date,
            "status": status,
            "expiry_state": self._derive_expiry_state(status, expiry_date),
            "message": "Supplier certification updated successfully.",
        }

    def extract_supplier_certification(
        self,
        supplier_id: int,
        file_bytes: bytes,
        expected_cert_name: str | None = None,
    ) -> dict:
        certs_df = pd.read_csv(self.data_dir / "certifications_v2.csv")
        text = onboarding_service.extract_text(file_bytes)
        lowered_text = text.casefold()

        cert_name = None
        for _, row in certs_df.iterrows():
            candidate = str(row.get("cert_name", "")).strip()
            if candidate and candidate.casefold() in lowered_text:
                cert_name = candidate
                break

        if not cert_name and expected_cert_name:
            cert_name = expected_cert_name
        if not cert_name:
            raise AppError("Unable to detect certification name from uploaded document", status_code=422)

        issue_date = self._extract_date_by_keywords(
            text,
            ["issue date", "issued on", "issued date", "valid from"],
        )
        expiry_date = self._extract_date_by_keywords(
            text,
            ["expiry date", "expires on", "expiration date", "valid until", "valid to"],
        )

        fallback_dates = self._extract_all_dates(text)
        if not issue_date and fallback_dates:
            issue_date = fallback_dates[0]
        if not expiry_date and len(fallback_dates) > 1:
            expiry_date = fallback_dates[-1]

        if not issue_date or not expiry_date:
            raise AppError("Unable to extract certificate dates from uploaded document", status_code=422)

        expiry_state = self._derive_expiry_state("Verified", expiry_date)
        status = "Expired" if expiry_state == "Expired" else "Verified"

        return {
            "supplier_id": supplier_id,
            "cert_name": cert_name,
            "issue_date": issue_date,
            "expiry_date": expiry_date,
            "status": status,
            "expiry_state": expiry_state,
            "extracted_text_preview": text[:700],
        }

    def _load_audit_context(self, audit_id: int) -> dict:
        audits_df = pd.read_csv(self.data_dir / "audits_v2.csv")
        suppliers_df = pd.read_csv(self.data_dir / "suppliers_v2.csv")
        supplier_certs_df = pd.read_csv(self.data_dir / "supplier_certifications_v2.csv")
        certs_df = pd.read_csv(self.data_dir / "certifications_v2.csv")

        audit_match = audits_df[audits_df["audit_id"] == audit_id]
        if audit_match.empty:
            raise AppError("Audit not found", status_code=404)

        audit_row = audit_match.iloc[0]
        supplier_id = int(audit_row["supplier_id"])

        supplier_match = suppliers_df[suppliers_df["supplier_id"] == supplier_id]
        supplier_row = supplier_match.iloc[0].to_dict() if not supplier_match.empty else {}

        history_rows = audits_df[audits_df["supplier_id"] == supplier_id].sort_values(
            by="audit_date", ascending=False
        )
        history = history_rows.head(5).to_dict(orient="records")

        cert_rows = supplier_certs_df[supplier_certs_df["supplier_id"] == supplier_id].merge(
            certs_df,
            on="cert_id",
            how="left",
        )
        certifications = []
        for _, row in cert_rows.iterrows():
            raw_status = str(row.get("status", "")).strip() or "Pending"
            expiry_date = str(row.get("expiry_date", "")).strip()
            certifications.append(
                {
                    "cert_name": row.get("cert_name"),
                    "status": raw_status,
                    "issue_date": str(row.get("issue_date", "")).strip(),
                    "expiry_date": expiry_date,
                    "expiry_state": self._derive_expiry_state(raw_status, expiry_date),
                }
            )

        return {
            "selected_audit": {
                "audit_id": int(audit_row["audit_id"]),
                "supplier_id": supplier_id,
                "audit_date": str(audit_row["audit_date"]),
                "type": str(audit_row["type"]),
                "score": float(audit_row["score"]),
                "non_compliance": int(audit_row["non_compliance"]),
            },
            "supplier": supplier_row,
            "audit_history": history,
            "certifications": certifications,
        }

    def _build_fallback_insights(self, context: dict) -> dict:
        audit = context["selected_audit"]
        certifications = context["certifications"]
        history = context["audit_history"]

        verified_count = sum(1 for cert in certifications if cert.get("status") == "Verified")
        expired_count = sum(1 for cert in certifications if cert.get("expiry_state") == "Expired")
        expiring_soon_count = sum(
            1 for cert in certifications if cert.get("expiry_state") == "Expiring soon"
        )
        score = float(audit["score"])
        non_compliance = int(audit["non_compliance"])

        if non_compliance >= 4 or expired_count > 0:
            decision = "Corrective action required"
        elif verified_count == len(certifications) and certifications:
            decision = "Monitor"
        else:
            decision = "Pass with conditions"

        summary = (
            f"Audit #{audit['audit_id']} for supplier #{audit['supplier_id']} is being reviewed "
            f"with score {score:.2f} and {non_compliance} non-compliance items."
        )

        return {
            "summary": summary,
            "key_concerns": [
                f"Non-compliance count is {non_compliance}.",
                f"Verified certifications in current context: {verified_count} of {len(certifications)}.",
                f"Expired certifications: {expired_count}; expiring soon: {expiring_soon_count}.",
            ],
            "reviewer_focus": [
                "Compare this audit against recent supplier audit history.",
                "Check whether expired or pending certifications weaken the current audit position.",
            ],
            "next_actions": [
                "Review the selected audit against prior supplier audits.",
                "Confirm certification validity and expiry status before closing the review.",
            ],
            "suggested_decision": decision,
            "confidence": "medium" if len(history) > 1 else "low",
        }

    def _derive_expiry_state(self, status: str, expiry_date_text: str) -> str:
        try:
            expiry_value = date.fromisoformat(expiry_date_text)
        except ValueError:
            return "Pending" if status.lower() == "pending" else "Unknown"

        today = date.today()
        days_until_expiry = (expiry_value - today).days
        if days_until_expiry < 0:
            return "Expired"
        if days_until_expiry <= 30:
            return "Expiring soon"
        if status.lower() == "pending":
            return "Pending"
        return "Valid"

    def _extract_json_block(self, text: str) -> str:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            return cleaned
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return cleaned[start : end + 1]
        return cleaned

    def _extract_date_by_keywords(self, text: str, keywords: list[str]) -> str | None:
        lowered_text = text.casefold()
        for keyword in keywords:
            position = lowered_text.find(keyword.casefold())
            if position == -1:
                continue
            window = text[position : position + 120]
            dates = self._extract_all_dates(window)
            if dates:
                return dates[0]
        return None

    def _extract_all_dates(self, text: str) -> list[str]:
        patterns = [
            r"\b(\d{4}-\d{2}-\d{2})\b",
            r"\b(\d{2}/\d{2}/\d{4})\b",
            r"\b(\d{2}-\d{2}-\d{4})\b",
        ]
        found: list[str] = []
        for pattern in patterns:
            for match in re.findall(pattern, text):
                normalized = self._normalize_date(match)
                if normalized and normalized not in found:
                    found.append(normalized)
        return found

    def _normalize_date(self, value: str) -> str | None:
        text = value.strip()
        for parser in (
            lambda v: date.fromisoformat(v),
            lambda v: date(int(v[6:10]), int(v[3:5]), int(v[0:2])),
        ):
            try:
                return parser(text).isoformat()
            except Exception:
                continue
        if "/" in text:
            try:
                day, month, year = text.split("/")
                return date(int(year), int(month), int(day)).isoformat()
            except Exception:
                return None
        return None


auditing_service = AuditingService()
