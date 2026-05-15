from __future__ import annotations

import hashlib
import json
import re
from datetime import date
from pathlib import Path

import pandas as pd

from ..ai.guardrails import GuardrailViolation, safe_guardrail_message
from ..ai.output_validation import validate_audit_decision, validate_audit_insights
from ..ai.prompt_registry import get_prompt_policy_block
from ..core.exceptions import AppError
from .ai_gateway import AiGatewayError, AiTextRequest, generate_ai_text
from .ai_review_queue import add_review_item
from .onboarding_service import onboarding_service
from .database import csv_table_name, install_pandas_database_bridge, table_exists

install_pandas_database_bridge()


class AuditingService:
    def __init__(self) -> None:
        self.data_dir = Path(__file__).resolve().parents[3] / "data"
        self.audit_uploads_dir = Path(__file__).resolve().parents[3] / "uploads" / "auditing" / "evidence"

    def get_audit_workspace(self, audit_id: int | None = None) -> dict:
        audits_df = pd.read_csv(self.data_dir / "audits_v2.csv")
        suppliers_df = pd.read_csv(self.data_dir / "suppliers_v2.csv")
        supplier_certs_df = pd.read_csv(self.data_dir / "supplier_certifications_v2.csv")
        certs_df = pd.read_csv(self.data_dir / "certifications_v2.csv")
        evidence_df = self._read_optional_csv(self.data_dir / "supplier_evidence_v2.csv")
        audit_evidence_df = self._ensure_audit_evidence_store()
        capa_df = self._ensure_capa_store()

        supplier_lookup = suppliers_df.set_index("supplier_id").to_dict(orient="index")
        queue = []
        for _, audit_row in audits_df.iterrows():
            supplier_id = int(audit_row["supplier_id"])
            supplier = supplier_lookup.get(supplier_id, {})
            certifications = self._build_certification_context(supplier_id, supplier_certs_df, certs_df)
            evidence_summary = self._build_combined_evidence_summary(
                supplier_id=supplier_id,
                audit_id=int(audit_row["audit_id"]),
                supplier_evidence_df=evidence_df,
                audit_evidence_df=audit_evidence_df,
            )
            non_compliance = int(audit_row["non_compliance"])
            score = float(audit_row["score"])
            expired_count = sum(1 for cert in certifications if cert["expiry_state"] == "Expired")
            needs_review_count = evidence_summary["needs_review_count"]
            derived_priority = self._derive_audit_priority(
                score=score,
                non_compliance=non_compliance,
                expired_count=expired_count,
                needs_review_count=needs_review_count,
                eudr_relevant=str(supplier.get("eudr_relevant", "")),
            )
            priority = self._row_text(audit_row, "audit_priority") or derived_priority
            status = self._row_text(audit_row, "audit_status") or self._derive_audit_status(
                priority,
                non_compliance,
                expired_count,
                needs_review_count,
            )
            queue.append(
                {
                    "audit_id": int(audit_row["audit_id"]),
                    "supplier_id": supplier_id,
                    "supplier_name": supplier.get("supplier_name", f"Supplier {supplier_id}"),
                    "country": supplier.get("country"),
                    "tier": supplier.get("tier"),
                    "type": str(audit_row["type"]),
                    "audit_date": str(audit_row["audit_date"]),
                    "score": round(score, 2),
                    "non_compliance": non_compliance,
                    "priority": priority,
                    "status": status,
                    "decision": self._row_text(audit_row, "audit_decision") or "Pending",
                    "decision_date": self._row_text(audit_row, "decision_date"),
                    "capa_required": self._row_text(audit_row, "capa_required"),
                    "capa_status": self._row_text(audit_row, "capa_status"),
                    "capa_due_date": self._row_text(audit_row, "capa_due_date"),
                    "expired_certifications": expired_count,
                    "evidence_needs_review": needs_review_count,
                    "eudr_relevant": supplier.get("eudr_relevant"),
                    "traceability_required": supplier.get("traceability_required"),
                    "evidence_status": supplier.get("evidence_status"),
                }
            )

        queue.sort(key=lambda item: (self._priority_rank(item["priority"]), item["audit_date"]), reverse=True)
        selected_audit_id = audit_id or (queue[0]["audit_id"] if queue else None)
        if selected_audit_id is None:
            return {
                "queue": [],
                "selected_audit": None,
                "supplier": {},
                "audit_history": [],
                "certifications": [],
                "evidence_summary": self._empty_evidence_summary(),
                "capa_actions": [],
                "metrics": self._build_workspace_metrics([]),
            }

        context = self._load_audit_context(int(selected_audit_id))
        supplier_id = int(context["selected_audit"]["supplier_id"])
        context["evidence_summary"] = self._build_combined_evidence_summary(
            supplier_id=supplier_id,
            audit_id=int(selected_audit_id),
            supplier_evidence_df=evidence_df,
            audit_evidence_df=audit_evidence_df,
        )
        context["capa_actions"] = self._get_capa_actions(int(selected_audit_id), capa_df)
        context["queue"] = queue
        context["metrics"] = self._build_workspace_metrics(queue)
        return context

    def create_capa_action(self, payload: dict) -> dict:
        audit_id = int(payload["audit_id"])
        audits_df = pd.read_csv(self.data_dir / "audits_v2.csv")
        audit_match = audits_df[audits_df["audit_id"] == audit_id]
        if audit_match.empty:
            raise AppError("Audit not found", status_code=404)

        capa_df = self._ensure_capa_store()
        capa_id = self._next_capa_id(capa_df)
        today = date.today().isoformat()
        row = {
            "capa_id": capa_id,
            "audit_id": audit_id,
            "supplier_id": int(audit_match.iloc[0]["supplier_id"]),
            "issue": str(payload["issue"]).strip(),
            "severity": str(payload["severity"]).strip(),
            "owner": str(payload["owner"]).strip(),
            "description": str(payload.get("description") or "").strip(),
            "due_date": str(payload["due_date"]).strip(),
            "status": "Open",
            "evidence_required": str(payload.get("evidence_required") or "Yes").strip(),
            "supplier_response": "",
            "evidence_notes": "",
            "created_date": today,
            "closed_date": "",
        }
        capa_df = pd.concat([capa_df, pd.DataFrame([row])], ignore_index=True)
        capa_df.to_csv(self.data_dir / "audit_capa_v2.csv", index=False)
        rollup = self._update_audit_capa_rollup(audit_id)
        return {
            "message": "CAPA action created",
            "capa_action": row,
            "audit_rollup": rollup,
        }

    def update_capa_action(self, payload: dict) -> dict:
        capa_id = int(payload["capa_id"])
        capa_df = self._ensure_capa_store()
        capa_ids = pd.to_numeric(capa_df["capa_id"], errors="coerce")
        matches = capa_df.index[capa_ids == capa_id].tolist()
        if not matches:
            raise AppError("CAPA action not found", status_code=404)

        row_index = matches[0]
        for column in ["status", "supplier_response", "evidence_notes", "closed_date"]:
            if column in capa_df.columns:
                capa_df[column] = capa_df[column].astype("object")
        status = str(payload["status"]).strip()
        capa_df.at[row_index, "status"] = status
        if payload.get("supplier_response") is not None:
            capa_df.at[row_index, "supplier_response"] = str(payload.get("supplier_response") or "").strip()
        if payload.get("evidence_notes") is not None:
            capa_df.at[row_index, "evidence_notes"] = str(payload.get("evidence_notes") or "").strip()
        if status == "Closed":
            capa_df.at[row_index, "closed_date"] = date.today().isoformat()
        elif "closed_date" in capa_df.columns:
            capa_df.at[row_index, "closed_date"] = ""
        capa_df.to_csv(self.data_dir / "audit_capa_v2.csv", index=False)
        audit_id = int(capa_df.at[row_index, "audit_id"])
        rollup = self._update_audit_capa_rollup(audit_id)
        return {
            "message": "CAPA action updated",
            "capa_action": capa_df.loc[row_index].fillna("").to_dict(),
            "audit_rollup": rollup,
        }

    def upload_audit_evidence(
        self,
        audit_id: int,
        evidence_type: str,
        linked_capa_id: int | None,
        file_name: str,
        file_bytes: bytes,
    ) -> dict:
        if not file_bytes:
            raise AppError("Uploaded evidence file is empty", status_code=400)

        audits_df = pd.read_csv(self.data_dir / "audits_v2.csv")
        audit_match = audits_df[audits_df["audit_id"] == audit_id]
        if audit_match.empty:
            raise AppError("Audit not found", status_code=404)
        supplier_id = int(audit_match.iloc[0]["supplier_id"])

        saved_path = self._save_audit_evidence_file(file_name, file_bytes)
        try:
            extracted_text = onboarding_service.extract_text(file_bytes)
        except Exception:
            extracted_text = ""
        validation_status, validation_notes = self._validate_audit_evidence(evidence_type, extracted_text)

        evidence_df = self._ensure_audit_evidence_store()
        evidence_id = self._next_audit_evidence_id(evidence_df)
        row = {
            "audit_evidence_id": evidence_id,
            "audit_id": audit_id,
            "supplier_id": supplier_id,
            "linked_capa_id": linked_capa_id or "",
            "evidence_type": evidence_type,
            "file_name": file_name,
            "local_path": str(saved_path),
            "upload_date": date.today().isoformat(),
            "document_status": "Extracted" if extracted_text else "Uploaded",
            "validation_status": validation_status,
            "validation_notes": validation_notes,
            "extracted_text_preview": extracted_text[:700],
        }
        evidence_df = pd.concat([evidence_df, pd.DataFrame([row])], ignore_index=True)
        evidence_df.to_csv(self.data_dir / "audit_evidence_v2.csv", index=False)
        rollup = self._update_audit_evidence_rollup(audit_id)
        return {
            "message": "Audit evidence uploaded",
            "evidence": row,
            "audit_rollup": rollup,
        }

    def generate_audit_decision(self, audit_id: int) -> dict:
        context = self.get_audit_workspace(audit_id)
        decision_context = self._build_decision_context(context)
        fallback = self._build_fallback_decision(decision_context)
        prompt = f"""
You are an AI-assisted supplier audit decision engine.

{get_prompt_policy_block("auditing")}

Audit workspace context:
{json.dumps(decision_context, indent=2, default=str)}

Return strict JSON with this exact shape:
{{
  "recommendation": "Pass | Pass with Conditions | Corrective Action Required | Escalate | Suspend / Block",
  "confidence": "low|medium|high",
  "reasons": ["reason 1", "reason 2"],
  "required_actions": ["action 1", "action 2"],
  "closure_blockers": ["blocker 1", "blocker 2"]
}}

Rules:
- Use only the supplied audit, supplier, certification, evidence, and CAPA context.
- Do not invent evidence, audit findings, laws, or external facts.
- Recommend Suspend / Block only when the current context shows severe blockers such as high non-compliance plus unresolved evidence/CAPA risk.
- Recommend Pass only when audit risk is low and there are no closure blockers.
- If CAPA is open, closure blockers must mention open CAPA.
"""
        try:
            response = generate_ai_text(
                AiTextRequest(
                    feature="auditing",
                    prompt=prompt,
                    user_input=f"audit decision for audit_id {audit_id}",
                    context=decision_context,
                    response_format="json",
                )
            )
            parsed = json.loads(self._extract_json_block(response.text.strip()))
            if not isinstance(parsed, dict):
                return fallback
            decision = self._validate_audit_decision(parsed, fallback)
            decision["source"] = "llm"
            decision["provider"] = response.provider
            decision["model"] = response.model
            return decision
        except GuardrailViolation as exc:
            raise AppError(safe_guardrail_message(exc.result), status_code=400) from exc
        except (AiGatewayError, json.JSONDecodeError, ValueError):
            return fallback

    def apply_audit_decision(self, audit_id: int, decision: str, notes: str | None = None) -> dict:
        allowed = {"Pass", "Pass with Conditions", "Corrective Action Required", "Escalate", "Suspend / Block"}
        if decision not in allowed:
            raise AppError("Unsupported audit decision", status_code=400)

        audits_path = self.data_dir / "audits_v2.csv"
        audits_df = pd.read_csv(audits_path)
        audit_ids = pd.to_numeric(audits_df["audit_id"], errors="coerce")
        matches = audits_df.index[audit_ids == audit_id].tolist()
        if not matches:
            raise AppError("Audit not found", status_code=404)

        row_index = matches[0]
        for column in ["audit_decision", "decision_notes", "decision_date", "audit_status"]:
            if column not in audits_df.columns:
                audits_df[column] = ""
            audits_df[column] = audits_df[column].astype("object")

        audits_df.at[row_index, "audit_decision"] = decision
        audits_df.at[row_index, "decision_notes"] = (notes or "").strip()
        audits_df.at[row_index, "decision_date"] = date.today().isoformat()
        audits_df.at[row_index, "audit_status"] = self._status_from_decision(decision)
        audits_df.to_csv(audits_path, index=False)
        return {
            "message": "Audit decision applied",
            "audit_id": audit_id,
            "audit_decision": decision,
            "audit_status": self._status_from_decision(decision),
            "decision_date": date.today().isoformat(),
        }

    def close_audit(self, audit_id: int) -> dict:
        blockers = self._audit_closure_blockers(audit_id)
        if blockers:
            return {
                "message": "Audit cannot be closed",
                "audit_id": audit_id,
                "audit_status": "Closure blocked",
                "closure_blockers": blockers,
            }

        audits_path = self.data_dir / "audits_v2.csv"
        audits_df = pd.read_csv(audits_path)
        audit_ids = pd.to_numeric(audits_df["audit_id"], errors="coerce")
        matches = audits_df.index[audit_ids == audit_id].tolist()
        if not matches:
            raise AppError("Audit not found", status_code=404)
        row_index = matches[0]
        for column in ["audit_status", "decision_date"]:
            if column not in audits_df.columns:
                audits_df[column] = ""
            audits_df[column] = audits_df[column].astype("object")
        decision = self._row_text(audits_df.loc[row_index], "audit_decision")
        audits_df.at[row_index, "audit_status"] = "Closed with conditions" if decision == "Pass with Conditions" else "Closed"
        if not self._row_text(audits_df.loc[row_index], "decision_date"):
            audits_df.at[row_index, "decision_date"] = date.today().isoformat()
        audits_df.to_csv(audits_path, index=False)
        return {
            "message": "Audit closed",
            "audit_id": audit_id,
            "audit_status": str(audits_df.at[row_index, "audit_status"]),
            "closure_blockers": [],
        }

    def get_audit_insights(self, audit_id: int) -> dict:
        context = self._load_audit_context(audit_id)
        fallback = self._build_fallback_insights(context)

        prompt = f"""
You are helping with AI-assisted supplier auditing.

{get_prompt_policy_block("auditing")}

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
            response = generate_ai_text(
                AiTextRequest(
                    feature="auditing",
                    prompt=prompt,
                    user_input=f"audit insights for audit_id {audit_id}",
                    context=context,
                    response_format="json",
                )
            )
            parsed = json.loads(self._extract_json_block(response.text.strip()))
            if not isinstance(parsed, dict):
                return fallback

            validated = validate_audit_insights(parsed, fallback)
            validated["source"] = "llm"
            validated["provider"] = response.provider
            validated["model"] = response.model
            validated["trace_id"] = response.trace_id
            if validated["confidence"] == "low":
                add_review_item(
                    feature="auditing",
                    reason="low_confidence_ai_output",
                    prompt_hash=response.prompt_hash,
                    trace_id=response.trace_id,
                    payload={
                        "audit_id": audit_id,
                        "suggested_decision": validated["suggested_decision"],
                    },
                )
            return validated
        except GuardrailViolation as exc:
            raise AppError(safe_guardrail_message(exc.result), status_code=400) from exc
        except (AiGatewayError, json.JSONDecodeError, ValueError):
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

        certifications = self._build_certification_context(supplier_id, supplier_certs_df, certs_df)

        return {
            "selected_audit": {
                "audit_id": int(audit_row["audit_id"]),
                "supplier_id": supplier_id,
                "audit_date": str(audit_row["audit_date"]),
                "type": str(audit_row["type"]),
                "score": float(audit_row["score"]),
                "non_compliance": int(audit_row["non_compliance"]),
                "audit_priority": self._row_text(audit_row, "audit_priority"),
                "audit_status": self._row_text(audit_row, "audit_status"),
                "audit_decision": self._row_text(audit_row, "audit_decision"),
                "decision_notes": self._row_text(audit_row, "decision_notes"),
                "decision_date": self._row_text(audit_row, "decision_date"),
                "capa_required": self._row_text(audit_row, "capa_required"),
                "capa_due_date": self._row_text(audit_row, "capa_due_date"),
                "capa_status": self._row_text(audit_row, "capa_status"),
            },
            "supplier": supplier_row,
            "audit_history": history,
            "certifications": certifications,
        }

    def _build_certification_context(
        self,
        supplier_id: int,
        supplier_certs_df: pd.DataFrame,
        certs_df: pd.DataFrame,
    ) -> list[dict]:
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
                    "validation_status": str(row.get("validation_status", "")).strip(),
                    "certificate_number": str(row.get("certificate_number", "")).strip(),
                    "issuing_body": str(row.get("issuing_body", "")).strip(),
                    "scope": str(row.get("scope", "")).strip(),
                }
            )
        return certifications

    def _build_evidence_summary(self, supplier_id: int, evidence_df: pd.DataFrame) -> dict:
        if evidence_df.empty or "supplier_id" not in evidence_df.columns:
            return self._empty_evidence_summary()
        evidence_supplier_ids = pd.to_numeric(evidence_df["supplier_id"], errors="coerce")
        rows = evidence_df[evidence_supplier_ids == supplier_id]
        if rows.empty:
            return self._empty_evidence_summary()
        records = []
        for _, row in rows.sort_values(by="upload_date", ascending=False).head(10).iterrows():
            records.append(
                {
                    "evidence_id": self._safe_int(row.get("evidence_id")),
                    "evidence_type": row.get("evidence_type"),
                    "linked_entity_type": row.get("linked_entity_type"),
                    "linked_entity_name": row.get("linked_entity_name"),
                    "file_name": row.get("file_name"),
                    "upload_date": row.get("upload_date"),
                    "validation_status": row.get("validation_status"),
                    "review_status": row.get("review_status"),
                    "validation_notes": row.get("validation_notes"),
                }
            )
        statuses = rows["validation_status"].astype(str).str.strip().str.lower()
        return {
            "total_count": int(len(rows)),
            "verified_count": int(statuses.isin(["verified", "complete"]).sum()),
            "needs_review_count": int(statuses.isin(["needs review", "expired"]).sum()),
            "latest_upload_date": str(rows["upload_date"].dropna().max()) if "upload_date" in rows else None,
            "recent_records": records,
        }

    def _build_audit_evidence_summary(self, audit_id: int, evidence_df: pd.DataFrame) -> dict:
        if evidence_df.empty or "audit_id" not in evidence_df.columns:
            return self._empty_evidence_summary()
        audit_ids = pd.to_numeric(evidence_df["audit_id"], errors="coerce")
        rows = evidence_df[audit_ids == audit_id]
        if rows.empty:
            return self._empty_evidence_summary()
        records = []
        for _, row in rows.sort_values(by="upload_date", ascending=False).head(10).iterrows():
            records.append(
                {
                    "evidence_id": self._safe_int(row.get("audit_evidence_id")),
                    "evidence_type": row.get("evidence_type"),
                    "linked_entity_type": "Audit Evidence",
                    "linked_entity_name": row.get("evidence_type"),
                    "file_name": row.get("file_name"),
                    "upload_date": row.get("upload_date"),
                    "validation_status": row.get("validation_status"),
                    "review_status": row.get("validation_status"),
                    "validation_notes": row.get("validation_notes"),
                }
            )
        statuses = rows["validation_status"].astype(str).str.strip().str.lower()
        return {
            "total_count": int(len(rows)),
            "verified_count": int(statuses.isin(["accepted"]).sum()),
            "needs_review_count": int(statuses.isin(["needs review"]).sum()),
            "latest_upload_date": str(rows["upload_date"].dropna().max()) if "upload_date" in rows else None,
            "recent_records": records,
        }

    def _build_combined_evidence_summary(
        self,
        supplier_id: int,
        audit_id: int,
        supplier_evidence_df: pd.DataFrame,
        audit_evidence_df: pd.DataFrame,
    ) -> dict:
        supplier_summary = self._build_evidence_summary(supplier_id, supplier_evidence_df)
        audit_summary = self._build_audit_evidence_summary(audit_id, audit_evidence_df)
        latest_dates = [
            value for value in [supplier_summary.get("latest_upload_date"), audit_summary.get("latest_upload_date")]
            if value
        ]
        return {
            "total_count": supplier_summary["total_count"] + audit_summary["total_count"],
            "verified_count": supplier_summary["verified_count"] + audit_summary["verified_count"],
            "needs_review_count": supplier_summary["needs_review_count"] + audit_summary["needs_review_count"],
            "latest_upload_date": max(latest_dates) if latest_dates else None,
            "recent_records": (audit_summary["recent_records"] + supplier_summary["recent_records"])[:10],
            "supplier_evidence_count": supplier_summary["total_count"],
            "audit_evidence_count": audit_summary["total_count"],
        }

    def _empty_evidence_summary(self) -> dict:
        return {
            "total_count": 0,
            "verified_count": 0,
            "needs_review_count": 0,
            "latest_upload_date": None,
            "recent_records": [],
        }

    def _derive_audit_priority(
        self,
        score: float,
        non_compliance: int,
        expired_count: int,
        needs_review_count: int,
        eudr_relevant: str,
    ) -> str:
        if non_compliance >= 4 or score < 70 or expired_count > 0 or needs_review_count > 0:
            return "High"
        if non_compliance >= 2 or score < 85 or eudr_relevant == "Yes":
            return "Medium"
        return "Low"

    def _derive_audit_status(
        self,
        priority: str,
        non_compliance: int,
        expired_count: int,
        needs_review_count: int,
    ) -> str:
        if expired_count > 0 or needs_review_count > 0:
            return "Evidence review required"
        if non_compliance >= 4:
            return "Corrective action likely"
        if priority == "Medium":
            return "Open review"
        return "Monitor"

    def _priority_rank(self, priority: str) -> int:
        return {"Low": 1, "Medium": 2, "High": 3}.get(priority, 0)

    def _build_workspace_metrics(self, queue: list[dict]) -> dict:
        return {
            "total_audits": len(queue),
            "high_priority": sum(1 for item in queue if item["priority"] == "High"),
            "open_review": sum(1 for item in queue if item["status"] != "Monitor"),
            "evidence_review_required": sum(
                1 for item in queue if item["status"] == "Evidence review required"
            ),
        }

    def _build_fallback_decision(self, context: dict) -> dict:
        audit = context.get("selected_audit") or {}
        certifications = context.get("certifications") or []
        evidence = context.get("evidence_summary") or self._empty_evidence_summary()
        capa_actions = context.get("capa_actions") or []
        non_compliance = int(audit.get("non_compliance") or 0)
        score = float(audit.get("score") or 0)
        expired_count = sum(1 for cert in certifications if cert.get("expiry_state") == "Expired")
        needs_review = int(evidence.get("needs_review_count") or 0)
        open_capa = [action for action in capa_actions if str(action.get("status")) != "Closed"]

        blockers = []
        reasons = [
            f"Audit score is {score:.2f} with {non_compliance} non-compliance items.",
            f"Expired certifications: {expired_count}; evidence records needing review: {needs_review}.",
        ]
        if open_capa:
            blockers.append(f"{len(open_capa)} CAPA action(s) are still open.")
        if expired_count:
            blockers.append("One or more certifications are expired.")
        if needs_review:
            blockers.append("Evidence requiring review is present.")

        if non_compliance >= 5 and blockers:
            recommendation = "Suspend / Block"
        elif non_compliance >= 4 or expired_count or needs_review or open_capa:
            recommendation = "Corrective Action Required"
        elif non_compliance >= 2 or score < 85:
            recommendation = "Pass with Conditions"
        else:
            recommendation = "Pass"

        return {
            "recommendation": recommendation,
            "confidence": "medium",
            "reasons": reasons,
            "required_actions": self._fallback_decision_actions(recommendation, blockers),
            "closure_blockers": blockers,
            "source": "deterministic_fallback",
            "provider": None,
            "model": None,
        }

    def _build_decision_context(self, context: dict) -> dict:
        supplier = context.get("supplier") or {}
        return {
            "selected_audit": context.get("selected_audit"),
            "supplier": {
                "supplier_id": supplier.get("supplier_id"),
                "supplier_name": supplier.get("supplier_name"),
                "country": supplier.get("country"),
                "tier": supplier.get("tier"),
                "status": supplier.get("status"),
                "evidence_status": supplier.get("evidence_status"),
                "eudr_relevant": supplier.get("eudr_relevant"),
                "traceability_required": supplier.get("traceability_required"),
            },
            "audit_history": (context.get("audit_history") or [])[:5],
            "certifications": context.get("certifications") or [],
            "evidence_summary": context.get("evidence_summary") or self._empty_evidence_summary(),
            "capa_actions": context.get("capa_actions") or [],
        }

    def _fallback_decision_actions(self, recommendation: str, blockers: list[str]) -> list[str]:
        if recommendation == "Pass":
            return ["Close the audit if business review confirms no additional evidence is required."]
        if recommendation == "Pass with Conditions":
            return ["Document audit conditions and schedule monitoring follow-up."]
        if recommendation == "Suspend / Block":
            return ["Block approval/closure until blockers are resolved.", "Escalate supplier to responsible sourcing leadership."]
        if blockers:
            return ["Create or update CAPA actions for each blocker.", "Request corrected evidence from the supplier."]
        return ["Create CAPA actions and monitor completion before closure."]

    def _validate_audit_decision(self, parsed: dict, fallback: dict) -> dict:
        return validate_audit_decision(parsed, fallback)

    def _status_from_decision(self, decision: str) -> str:
        return {
            "Pass": "Ready to close",
            "Pass with Conditions": "Ready to close with conditions",
            "Corrective Action Required": "CAPA open",
            "Escalate": "Escalated",
            "Suspend / Block": "Blocked",
        }.get(decision, "Open review")

    def _audit_closure_blockers(self, audit_id: int) -> list[str]:
        context = self.get_audit_workspace(audit_id)
        audit = context.get("selected_audit") or {}
        decision = str(audit.get("audit_decision") or "").strip()
        evidence = context.get("evidence_summary") or self._empty_evidence_summary()
        capa_actions = context.get("capa_actions") or []
        blockers: list[str] = []

        if decision not in {"Pass", "Pass with Conditions"}:
            blockers.append("Audit decision must be Pass or Pass with Conditions before clean closure.")
        if int(evidence.get("needs_review_count") or 0) > 0:
            blockers.append("Evidence still needs review.")
        open_capa = [action for action in capa_actions if str(action.get("status")) != "Closed"]
        if open_capa:
            blockers.append(f"{len(open_capa)} CAPA action(s) are still open.")
        if decision == "Pass" and int(evidence.get("total_count") or 0) == 0:
            blockers.append("Clean pass requires at least one accepted audit or supplier evidence record.")
        return blockers

    def _read_optional_csv(self, path: Path) -> pd.DataFrame:
        table_name = csv_table_name(path)
        if not path.exists() and not (table_name and table_exists(table_name)):
            return pd.DataFrame()
        return pd.read_csv(path)

    def _safe_int(self, value: object) -> int | None:
        try:
            if pd.isna(value):
                return None
            return int(value)
        except Exception:
            return None

    def _row_text(self, row: pd.Series, column: str) -> str:
        if column not in row:
            return ""
        value = row.get(column)
        if pd.isna(value):
            return ""
        return str(value).strip()

    def _ensure_capa_store(self) -> pd.DataFrame:
        path = self.data_dir / "audit_capa_v2.csv"
        columns = [
            "capa_id",
            "audit_id",
            "supplier_id",
            "issue",
            "severity",
            "owner",
            "description",
            "due_date",
            "status",
            "evidence_required",
            "supplier_response",
            "evidence_notes",
            "created_date",
            "closed_date",
        ]
        table_name = csv_table_name(path)
        if not path.exists() and not (table_name and table_exists(table_name)):
            df = pd.DataFrame(columns=columns)
            df.to_csv(path, index=False)
            return df
        df = pd.read_csv(path)
        for column in columns:
            if column not in df.columns:
                df[column] = ""
        return df[columns]

    def _ensure_audit_evidence_store(self) -> pd.DataFrame:
        path = self.data_dir / "audit_evidence_v2.csv"
        columns = [
            "audit_evidence_id",
            "audit_id",
            "supplier_id",
            "linked_capa_id",
            "evidence_type",
            "file_name",
            "local_path",
            "upload_date",
            "document_status",
            "validation_status",
            "validation_notes",
            "extracted_text_preview",
        ]
        table_name = csv_table_name(path)
        if not path.exists() and not (table_name and table_exists(table_name)):
            df = pd.DataFrame(columns=columns)
            df.to_csv(path, index=False)
            return df
        df = pd.read_csv(path)
        for column in columns:
            if column not in df.columns:
                df[column] = ""
        return df[columns]

    def _next_audit_evidence_id(self, evidence_df: pd.DataFrame) -> int:
        if evidence_df.empty:
            return 1
        values = pd.to_numeric(evidence_df["audit_evidence_id"], errors="coerce")
        current_max = values.max()
        if pd.isna(current_max):
            return 1
        return int(current_max) + 1

    def _save_audit_evidence_file(self, file_name: str, file_bytes: bytes) -> Path:
        self.audit_uploads_dir.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(file_bytes + file_name.encode("utf-8")).hexdigest()[:24]
        safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", file_name).strip("_") or "audit_evidence"
        path = self.audit_uploads_dir / f"{digest}_{safe_name}"
        path.write_bytes(file_bytes)
        return path

    def _validate_audit_evidence(self, evidence_type: str, extracted_text: str) -> tuple[str, str]:
        lowered = extracted_text.lower()
        if not extracted_text.strip():
            return "Needs Review", "Document text could not be extracted"
        gap_signals = ["missing", "not provided", "not documented", "open finding", "unresolved", "expired"]
        if any(signal in lowered for signal in gap_signals):
            return "Needs Review", "Evidence text contains gap or unresolved-status signals"
        required_by_type = {
            "Audit Report": ["audit", "score"],
            "Non-Compliance Evidence": ["non-compliance", "finding"],
            "CAPA Proof": ["corrective", "action"],
            "Supplier Response": ["supplier", "response"],
        }
        required = required_by_type.get(evidence_type, [])
        missing = [keyword for keyword in required if keyword not in lowered]
        if missing:
            return "Needs Review", f"Missing expected audit evidence signals: {', '.join(missing)}"
        return "Accepted", f"{evidence_type} evidence extracted and accepted"

    def _update_audit_evidence_rollup(self, audit_id: int) -> dict:
        evidence_df = self._ensure_audit_evidence_store()
        audits_path = self.data_dir / "audits_v2.csv"
        audits_df = pd.read_csv(audits_path)
        audit_ids = pd.to_numeric(audits_df["audit_id"], errors="coerce")
        matches = audits_df.index[audit_ids == audit_id].tolist()
        if not matches:
            raise AppError("Audit not found", status_code=404)
        audit_evidence_summary = self._build_audit_evidence_summary(audit_id, evidence_df)
        row_index = matches[0]
        for column in ["audit_status"]:
            if column not in audits_df.columns:
                audits_df[column] = ""
            audits_df[column] = audits_df[column].astype("object")
        if audit_evidence_summary["needs_review_count"] > 0:
            audits_df.at[row_index, "audit_status"] = "Evidence review required"
        elif audit_evidence_summary["total_count"] > 0 and not str(audits_df.at[row_index, "audit_status"] or "").strip():
            audits_df.at[row_index, "audit_status"] = "Open review"
        audits_df.to_csv(audits_path, index=False)
        return {"audit_id": audit_id, **audit_evidence_summary}

    def _next_capa_id(self, capa_df: pd.DataFrame) -> int:
        if capa_df.empty:
            return 1
        values = pd.to_numeric(capa_df["capa_id"], errors="coerce")
        current_max = values.max()
        if pd.isna(current_max):
            return 1
        return int(current_max) + 1

    def _get_capa_actions(self, audit_id: int, capa_df: pd.DataFrame) -> list[dict]:
        if capa_df.empty:
            return []
        audit_ids = pd.to_numeric(capa_df["audit_id"], errors="coerce")
        rows = capa_df[audit_ids == audit_id]
        if rows.empty:
            return []
        rows = rows.sort_values(by=["status", "due_date"], ascending=[True, True])
        return [row.fillna("").to_dict() for _, row in rows.iterrows()]

    def _update_audit_capa_rollup(self, audit_id: int) -> dict:
        audits_path = self.data_dir / "audits_v2.csv"
        audits_df = pd.read_csv(audits_path)
        capa_df = self._ensure_capa_store()
        audit_ids = pd.to_numeric(audits_df["audit_id"], errors="coerce")
        matches = audits_df.index[audit_ids == audit_id].tolist()
        if not matches:
            raise AppError("Audit not found", status_code=404)

        actions = self._get_capa_actions(audit_id, capa_df)
        open_actions = [action for action in actions if str(action.get("status", "")).strip() != "Closed"]
        due_dates = [str(action.get("due_date", "")).strip() for action in open_actions if str(action.get("due_date", "")).strip()]
        capa_required = "Yes" if actions else "No"
        if not actions:
            capa_status = "Not Required"
        elif open_actions:
            capa_status = "In Progress"
        else:
            capa_status = "Closed"

        row_index = matches[0]
        for column in ["capa_required", "capa_status", "capa_due_date", "audit_status"]:
            if column not in audits_df.columns:
                audits_df[column] = ""
            audits_df[column] = audits_df[column].astype("object")
        audits_df.at[row_index, "capa_required"] = capa_required
        audits_df.at[row_index, "capa_status"] = capa_status
        audits_df.at[row_index, "capa_due_date"] = min(due_dates) if due_dates else ""
        if open_actions:
            audits_df.at[row_index, "audit_status"] = "CAPA open"
        elif actions:
            audits_df.at[row_index, "audit_status"] = "CAPA closed"
        audits_df.to_csv(audits_path, index=False)
        return {
            "audit_id": audit_id,
            "capa_required": capa_required,
            "capa_status": capa_status,
            "capa_due_date": min(due_dates) if due_dates else "",
            "open_capa_count": len(open_actions),
            "total_capa_count": len(actions),
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
            "source": "deterministic_fallback",
            "provider": None,
            "model": None,
            "trace_id": None,
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
