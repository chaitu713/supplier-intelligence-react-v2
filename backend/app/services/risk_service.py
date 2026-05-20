from datetime import date
import json
import threading
import time

import pandas as pd

from ..ai.guardrails import GuardrailViolation
from ..ai.output_validation import validate_due_diligence_summary
from ..ai.prompt_registry import get_prompt_policy_block
from ..core.exceptions import AppError
from ..core.logging import get_logger
from .ai_gateway import AiGatewayError, AiTextRequest, generate_ai_text
from .ai_review_queue import add_review_item
from .dataset_service import DatasetService

logger = get_logger(__name__)
RISK_REFERENCE_DATE = pd.Timestamp("2026-04-27")


class RiskService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()
        self._risk_frame_cache: tuple[float, pd.DataFrame] | None = None
        self._risk_frame_cache_seconds = 120
        self._risk_frame_lock = threading.RLock()

    def get_risk_overview(self) -> dict:
        risk_frame = self._build_supplier_risk_frame()
        high_risk = risk_frame[risk_frame["overall_risk_level"] == "High"]
        medium_risk = risk_frame[risk_frame["overall_risk_level"] == "Medium"]
        low_risk = risk_frame[risk_frame["overall_risk_level"] == "Low"]

        return {
            "highRiskCount": int(len(high_risk)),
            "mediumRiskCount": int(len(medium_risk)),
            "lowRiskCount": int(len(low_risk)),
            "avgRiskScore": round(float(risk_frame["overall_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
            "avgOperationalRisk": round(float(risk_frame["operational_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
            "avgEsgRisk": round(float(risk_frame["esg_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
            "avgOverallRisk": round(float(risk_frame["overall_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
        }

    def get_risk_distribution(self, bins: int = 7) -> list[dict]:
        risk_frame = self._build_supplier_risk_frame()
        if risk_frame.empty:
            return []

        scores = pd.to_numeric(risk_frame["overall_risk_score"], errors="coerce").dropna()
        if scores.empty:
            return []

        value_counts = pd.cut(scores, bins=max(1, bins), include_lowest=True).value_counts(
            sort=False
        )

        histogram = []
        for interval, count in value_counts.items():
            histogram.append(
                {
                    "label": f"{float(interval.left):.1f}-{float(interval.right):.1f}",
                    "start": round(float(interval.left), 1),
                    "end": round(float(interval.right), 1),
                    "count": int(count),
                }
            )

        return histogram

    def get_risk_segmentation(self) -> list[dict]:
        risk_frame = self._build_supplier_risk_frame()
        if risk_frame.empty:
            return []

        counts = risk_frame["overall_risk_level"].value_counts()
        return [
            {"riskLevel": "High", "supplierCount": int(counts.get("High", 0))},
            {"riskLevel": "Medium", "supplierCount": int(counts.get("Medium", 0))},
            {"riskLevel": "Low", "supplierCount": int(counts.get("Low", 0))},
        ]

    def get_top_risk_suppliers(self, limit: int = 10) -> list[dict]:
        risk_frame = self._build_supplier_risk_frame()
        if risk_frame.empty:
            return []

        top_risk = risk_frame.sort_values("overall_risk_score", ascending=False).head(limit)
        return [
            {
                "supplierId": int(row["supplier_id"]),
                "supplierName": row.get("supplier_name"),
                "country": row.get("country"),
                "category": row.get("category"),
                "tier": row.get("tier"),
                "avgDelay": round(float(row.get("avg_delay", 0.0) or 0.0), 2),
                "avgDefect": round(float(row.get("avg_defect", 0.0) or 0.0), 4),
                "avgCostVariance": round(float(row.get("avg_cost_variance", 0.0) or 0.0), 2),
                "operationalRiskScore": round(float(row["operational_risk_score"]), 2),
                "esgRiskScore": round(float(row["esg_risk_score"]), 2),
                "overallRiskScore": round(float(row["overall_risk_score"]), 2),
                "riskScore": round(float(row["overall_risk_score"]), 2),
                "operationalRiskLevel": row["operational_risk_level"],
                "esgRiskLevel": row["esg_risk_level"],
                "riskLevel": row["overall_risk_level"],
            }
            for _, row in top_risk.iterrows()
        ]

    def run_due_diligence(self, supplier_id: int) -> dict:
        risk_frame = self._build_supplier_risk_frame()

        supplier_rows = risk_frame[risk_frame["supplier_id"] == supplier_id]
        if supplier_rows.empty:
            raise AppError("Supplier not found in risk dataset", status_code=404)

        supplier_row = supplier_rows.iloc[0]
        supplier_name = str(supplier_row["supplier_name"])
        connected_signals = self._build_due_diligence_signals(supplier_id)
        decision = self._recommend_due_diligence_decision(supplier_row, connected_signals)
        risk_drivers = self._build_due_diligence_risk_drivers(supplier_row, connected_signals)
        evidence_gaps = self._build_due_diligence_evidence_gaps(supplier_row, connected_signals)
        recommended_actions = self._build_due_diligence_actions(decision, evidence_gaps, connected_signals)
        checklist = self._build_due_diligence_checklist(supplier_row, connected_signals, evidence_gaps)
        result = self._generate_due_diligence_result(
            supplier_name=supplier_name,
            supplier_row=supplier_row,
            decision=decision,
            risk_drivers=risk_drivers,
            evidence_gaps=evidence_gaps,
            recommended_actions=recommended_actions,
            checklist=checklist,
            connected_signals=connected_signals,
        )

        case_id = self._persist_due_diligence_case(
            supplier_id=supplier_id,
            supplier_name=supplier_name,
            overall_score=float(supplier_row["overall_risk_score"]),
            decision=decision["decision"],
            rationale=decision["rationale"],
            recommended_actions=recommended_actions,
        )

        return {
            "caseId": case_id,
            "supplier": result["supplier"],
            "supplierId": supplier_id,
            "country": supplier_row.get("country"),
            "tier": supplier_row.get("tier"),
            "status": supplier_row.get("status"),
            "opRisk": result["op_risk"],
            "opRiskScore": round(float(supplier_row["operational_risk_score"]), 2),
            "esgRisk": result["esg_risk"],
            "esgRiskScore": round(float(supplier_row["esg_risk_score"]), 2),
            "overall": result["overall"],
            "overallRiskScore": round(float(supplier_row["overall_risk_score"]), 2),
            "decision": decision["decision"],
            "decisionRationale": decision["rationale"],
            "investigationChecklist": checklist,
            "riskDrivers": risk_drivers,
            "evidenceGaps": evidence_gaps,
            "recommendedActions": recommended_actions,
            "connectedSignals": connected_signals,
            "issues": result["issues"],
            "aiSummary": result["ai_summary"],
        }

    def _generate_due_diligence_result(
        self,
        supplier_name: str,
        supplier_row: pd.Series,
        decision: dict,
        risk_drivers: list[dict],
        evidence_gaps: list[str],
        recommended_actions: list[str],
        checklist: list[dict],
        connected_signals: dict,
    ) -> dict:
        fallback = self._build_due_diligence_fallback_result(
            supplier_name,
            supplier_row,
            evidence_gaps,
            recommended_actions,
        )
        context = {
            "supplier": {
                "supplierId": int(supplier_row.get("supplier_id")),
                "supplierName": supplier_name,
                "country": supplier_row.get("country"),
                "tier": supplier_row.get("tier"),
                "status": supplier_row.get("status"),
            },
            "scores": {
                "operationalRisk": round(float(supplier_row.get("operational_risk_score") or 0), 2),
                "esgRisk": round(float(supplier_row.get("esg_risk_score") or 0), 2),
                "overallRisk": round(float(supplier_row.get("overall_risk_score") or 0), 2),
            },
            "decision": decision,
            "riskDrivers": risk_drivers,
            "evidenceGaps": evidence_gaps,
            "recommendedActions": recommended_actions,
            "investigationChecklist": checklist,
            "connectedSignals": connected_signals,
        }
        prompt = f"""
You are an AI-assisted supplier due diligence reviewer.

{get_prompt_policy_block("due_diligence")}

Write a concise reviewer-ready due diligence summary in plain English.

Required structure:
- Supplier posture
- Key risk drivers
- Evidence or review gaps
- Recommended next actions
- Human reviewer note

Grounding context:
{json.dumps(context, default=str, indent=2)}
"""
        try:
            response = generate_ai_text(
                AiTextRequest(
                    feature="due_diligence",
                    prompt=prompt,
                    user_input=f"due diligence summary for supplier {supplier_row.get('supplier_id')}",
                    context=context,
                )
            )
            original_summary = fallback["ai_summary"]
            validated_summary = validate_due_diligence_summary(response.text, original_summary)
            fallback["ai_summary"] = validated_summary
            fallback["ai_trace_id"] = response.trace_id
            fallback["ai_source"] = (
                "llm_validation_fallback"
                if validated_summary == original_summary and response.text != original_summary
                else "llm"
            )
            fallback["ai_provider"] = response.provider
            fallback["ai_model"] = response.model
            if fallback["ai_source"] == "llm_validation_fallback":
                add_review_item(
                    feature="due_diligence",
                    reason="output_validation_fallback",
                    prompt_hash=response.prompt_hash,
                    trace_id=response.trace_id,
                    payload={
                        "supplier_id": int(supplier_row.get("supplier_id")),
                        "supplier_name": supplier_name,
                        "fallback_summary": original_summary,
                    },
                )
        except GuardrailViolation:
            raise
        except AiGatewayError as exc:
            logger.warning("Due diligence AI provider failed; using deterministic fallback: %s", exc)
        except Exception as exc:
            logger.warning("Due diligence AI generation failed; using deterministic fallback: %s", exc)
        return fallback

    def _build_due_diligence_fallback_result(
        self,
        supplier_name: str,
        supplier_row: pd.Series,
        evidence_gaps: list[str],
        recommended_actions: list[str],
    ) -> dict:
        overall = str(supplier_row.get("overall_risk_level") or "Medium")
        operational = str(supplier_row.get("operational_risk_level") or "Medium")
        esg = str(supplier_row.get("esg_risk_level") or "Medium")
        issues = [
            f"Overall risk is {overall} with score {float(supplier_row.get('overall_risk_score') or 0):.1f}.",
            f"Operational risk is {operational}; ESG risk is {esg}.",
            *evidence_gaps[:3],
        ]
        summary = (
            f"{supplier_name} requires structured due diligence review. "
            f"The current risk frame shows {overall.lower()} overall risk, "
            f"{operational.lower()} operational risk, and {esg.lower()} ESG risk. "
            f"Recommended next action: {recommended_actions[0] if recommended_actions else 'Record reviewer decision.'}"
        )
        return {
            "supplier": supplier_name,
            "op_risk": operational,
            "esg_risk": esg,
            "overall": overall,
            "issues": issues,
            "ai_summary": summary,
            "ai_source": "deterministic_fallback",
            "ai_provider": None,
            "ai_model": None,
            "ai_trace_id": None,
        }

    def _build_due_diligence_signals(self, supplier_id: int) -> dict:
        settings = self.dataset_service.settings
        supplier_certs = self.dataset_service.load_optional_csv(
            settings.supplier_certifications_file,
            "supplier_certifications",
        )
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities = self.dataset_service.load_optional_csv(settings.commodities_file, "commodities")
        audits = self.dataset_service.load_optional_csv(settings.audits_file, "audits")
        audit_capa = self.dataset_service.load_optional_csv(settings.data_dir / "audit_capa_v2.csv", "audit_capa")
        trace_gaps = self.dataset_service.load_optional_csv(
            settings.data_dir / "traceability_gap_actions_v2.csv",
            "traceability_gap_actions",
        )
        trace_decisions = self.dataset_service.load_optional_csv(
            settings.data_dir / "traceability_decisions_v2.csv",
            "traceability_decisions",
        )

        cert_rows = supplier_certs[supplier_certs.get("supplier_id").eq(supplier_id)] if not supplier_certs.empty and "supplier_id" in supplier_certs.columns else pd.DataFrame()
        expired_cert_count = 0
        pending_cert_count = 0
        verified_cert_count = 0
        if not cert_rows.empty:
            statuses = cert_rows.get("status", pd.Series(dtype=str)).astype(str).str.lower()
            verified_cert_count = int(statuses.eq("verified").sum())
            pending_cert_count = int(statuses.eq("pending").sum())
            expiries = pd.to_datetime(cert_rows.get("expiry_date"), errors="coerce")
            expired_cert_count = int(expiries.lt(RISK_REFERENCE_DATE).sum())

        commodity_rows = pd.DataFrame()
        if (
            not supplier_commodity_map.empty
            and not commodities.empty
            and "supplier_id" in supplier_commodity_map.columns
            and "commodity_id" in supplier_commodity_map.columns
        ):
            commodity_rows = supplier_commodity_map[supplier_commodity_map["supplier_id"].eq(supplier_id)].merge(
                commodities,
                on="commodity_id",
                how="left",
            )
        high_risk_commodities = (
            commodity_rows[commodity_rows.get("risk_level", pd.Series(dtype=str)).astype(str).eq("High")]["commodity_name"].dropna().astype(str).tolist()
            if not commodity_rows.empty
            else []
        )

        audit_rows = audits[audits.get("supplier_id").eq(supplier_id)] if not audits.empty and "supplier_id" in audits.columns else pd.DataFrame()
        latest_audit_status = ""
        open_audit_count = 0
        if not audit_rows.empty:
            latest = audit_rows.sort_values("audit_date").tail(1).iloc[0]
            latest_audit_status = str(latest.get("audit_status") or latest.get("audit_decision") or "")
            open_audit_count = int(audit_rows.get("audit_status", pd.Series(dtype=str)).astype(str).str.contains("open|review|required|pending", case=False, regex=True).sum())

        capa_rows = audit_capa[audit_capa.get("supplier_id").eq(supplier_id)] if not audit_capa.empty and "supplier_id" in audit_capa.columns else pd.DataFrame()
        open_capa_count = 0
        if not capa_rows.empty:
            capa_statuses = capa_rows.get("status", pd.Series(dtype=str)).astype(str).str.lower()
            open_capa_count = int(capa_statuses.ne("closed").sum())

        trace_gap_rows = trace_gaps[trace_gaps.get("supplier_id").eq(supplier_id)] if not trace_gaps.empty and "supplier_id" in trace_gaps.columns else pd.DataFrame()
        open_trace_gap_count = 0
        trace_gap_types: list[str] = []
        if not trace_gap_rows.empty:
            statuses = trace_gap_rows.get("status", pd.Series(dtype=str)).astype(str).str.lower()
            open_trace_gap_count = int(statuses.ne("closed").sum())
            trace_gap_types = trace_gap_rows[statuses.ne("closed")].get("gap_type", pd.Series(dtype=str)).dropna().astype(str).tolist()

        latest_trace_decision = ""
        if not trace_decisions.empty and "supplier_id" in trace_decisions.columns:
            decision_rows = trace_decisions[trace_decisions["supplier_id"].eq(supplier_id)]
            if not decision_rows.empty:
                latest_trace_decision = str(decision_rows.tail(1).iloc[0].get("decision") or "")

        return {
            "verifiedCertificationCount": verified_cert_count,
            "expiredCertificationCount": expired_cert_count,
            "pendingCertificationCount": pending_cert_count,
            "highRiskCommodities": high_risk_commodities,
            "latestAuditStatus": latest_audit_status,
            "openAuditCount": open_audit_count,
            "openCapaCount": open_capa_count,
            "openTraceGapCount": open_trace_gap_count,
            "traceGapTypes": trace_gap_types,
            "latestTraceDecision": latest_trace_decision,
        }

    def _recommend_due_diligence_decision(self, supplier_row: pd.Series, signals: dict) -> dict:
        score = float(supplier_row.get("overall_risk_score") or 0)
        rationale: list[str] = []
        if score >= 75:
            decision = "Block / Suspend"
            rationale.append("Overall risk score is in the severe range.")
        elif score >= 65 or signals.get("openCapaCount", 0) > 0 or signals.get("openTraceGapCount", 0) > 1:
            decision = "Escalate"
            rationale.append("Supplier has high risk or unresolved operational trace/audit blockers.")
        elif score >= 55 or signals.get("expiredCertificationCount", 0) > 0 or signals.get("openTraceGapCount", 0) > 0:
            decision = "Enhanced Monitoring"
            rationale.append("Supplier needs closer monitoring before clean clearance.")
        elif signals.get("pendingCertificationCount", 0) > 0:
            decision = "Clear with Conditions"
            rationale.append("Supplier can proceed only with pending evidence follow-up.")
        else:
            decision = "Clear"
            rationale.append("No major due diligence blocker is currently detected.")

        if signals.get("highRiskCommodities"):
            rationale.append("Supplier is linked to high-risk commodities.")
        if signals.get("openCapaCount", 0) > 0:
            rationale.append("Open CAPA actions remain unresolved.")
        if signals.get("openTraceGapCount", 0) > 0:
            rationale.append("Open traceability gap actions remain unresolved.")
        return {"decision": decision, "rationale": rationale}

    def _build_due_diligence_risk_drivers(self, supplier_row: pd.Series, signals: dict) -> list[dict]:
        return [
            {"label": "Operational risk", "value": round(float(supplier_row.get("operational_risk_score") or 0), 2), "status": supplier_row.get("operational_risk_level")},
            {"label": "ESG risk", "value": round(float(supplier_row.get("esg_risk_score") or 0), 2), "status": supplier_row.get("esg_risk_level")},
            {"label": "High-risk commodities", "value": len(signals.get("highRiskCommodities", [])), "status": ", ".join(signals.get("highRiskCommodities", [])) or "None"},
            {"label": "Open CAPA", "value": signals.get("openCapaCount", 0), "status": "Requires action" if signals.get("openCapaCount", 0) else "None"},
            {"label": "Open trace gaps", "value": signals.get("openTraceGapCount", 0), "status": "Requires action" if signals.get("openTraceGapCount", 0) else "None"},
        ]

    def _build_due_diligence_evidence_gaps(self, supplier_row: pd.Series, signals: dict) -> list[str]:
        gaps: list[str] = []
        if signals.get("expiredCertificationCount", 0) > 0:
            gaps.append("Expired certification evidence needs refresh.")
        if signals.get("pendingCertificationCount", 0) > 0:
            gaps.append("Pending certification evidence needs reviewer confirmation.")
        for gap_type in signals.get("traceGapTypes", []):
            gaps.append(f"Traceability gap open: {gap_type}.")
        if str(supplier_row.get("evidence_status") or "").lower() in {"missing evidence", "baseline only", "needs review"}:
            gaps.append(f"Supplier evidence status is {supplier_row.get('evidence_status')}.")
        return gaps or ["No major evidence gaps detected from current datasets."]

    def _build_due_diligence_actions(self, decision: dict, gaps: list[str], signals: dict) -> list[str]:
        actions = ["Record due diligence decision and reviewer notes."]
        if decision["decision"] in {"Escalate", "Block / Suspend"}:
            actions.append("Escalate supplier to compliance leadership before new sourcing approval.")
        if signals.get("openCapaCount", 0) > 0:
            actions.append("Resolve open audit CAPA actions before clean clearance.")
        if signals.get("openTraceGapCount", 0) > 0:
            actions.append("Close open traceability gaps after accepted evidence review.")
        if any("certification" in gap.lower() for gap in gaps):
            actions.append("Request refreshed certification evidence from supplier.")
        if len(actions) == 1:
            actions.append("Keep supplier in normal monitoring cadence.")
        return actions

    def _build_due_diligence_checklist(self, supplier_row: pd.Series, signals: dict, gaps: list[str]) -> list[dict]:
        return [
            {"label": "Supplier identity reviewed", "status": "Complete", "detail": f"{supplier_row.get('supplier_name')} in {supplier_row.get('country')}"},
            {"label": "Country and commodity risk reviewed", "status": "Complete", "detail": ", ".join(signals.get("highRiskCommodities", [])) or "No high-risk commodities detected"},
            {"label": "Certification health reviewed", "status": "Needs Review" if signals.get("expiredCertificationCount", 0) or signals.get("pendingCertificationCount", 0) else "Complete", "detail": f"{signals.get('verifiedCertificationCount', 0)} verified, {signals.get('expiredCertificationCount', 0)} expired, {signals.get('pendingCertificationCount', 0)} pending"},
            {"label": "Audit and CAPA reviewed", "status": "Needs Review" if signals.get("openCapaCount", 0) else "Complete", "detail": signals.get("latestAuditStatus") or "No blocking audit status"},
            {"label": "Traceability reviewed", "status": "Needs Review" if signals.get("openTraceGapCount", 0) else "Complete", "detail": signals.get("latestTraceDecision") or "No saved trace decision"},
            {"label": "Evidence gaps reviewed", "status": "Needs Review" if gaps and not gaps[0].startswith("No major") else "Complete", "detail": f"{len(gaps)} evidence finding(s)"},
        ]

    def _persist_due_diligence_case(
        self,
        supplier_id: int,
        supplier_name: str,
        overall_score: float,
        decision: str,
        rationale: list[str],
        recommended_actions: list[str],
    ) -> str:
        settings = self.dataset_service.settings
        today = date.today().isoformat()
        cases_file = settings.data_dir / "due_diligence_cases_v2.csv"
        decisions_file = settings.data_dir / "due_diligence_decisions_v2.csv"
        cases = self.dataset_service.load_optional_csv(cases_file, "due_diligence_cases")
        next_id = len(cases) + 1 if not cases.empty else 1
        case_id = f"DD-{supplier_id}-{next_id:03d}"
        case_row = pd.DataFrame([{
            "case_id": case_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier_name,
            "case_date": today,
            "overall_risk_score": round(overall_score, 2),
            "decision": decision,
            "status": "Generated",
            "summary": "Due diligence case generated from risk, audit, certification, and traceability context.",
        }])
        decision_row = pd.DataFrame([{
            "decision_id": f"DDD-{supplier_id}-{next_id:03d}",
            "case_id": case_id,
            "supplier_id": supplier_id,
            "decision_date": today,
            "decision": decision,
            "rationale": " | ".join(rationale),
            "recommended_actions": " | ".join(recommended_actions),
        }])
        updated_cases = case_row if cases.empty else pd.concat([cases, case_row], ignore_index=True)
        updated_cases.to_csv(cases_file, index=False)
        decisions = self.dataset_service.load_optional_csv(decisions_file, "due_diligence_decisions")
        updated_decisions = decision_row if decisions.empty else pd.concat([decisions, decision_row], ignore_index=True)
        updated_decisions.to_csv(decisions_file, index=False)
        return case_id

    def _build_supplier_risk_frame(self) -> pd.DataFrame:
        now = time.monotonic()
        with self._risk_frame_lock:
            if (
                self._risk_frame_cache
                and now - self._risk_frame_cache[0] < self._risk_frame_cache_seconds
            ):
                return self._risk_frame_cache[1].copy(deep=True)

        suppliers = self.dataset_service.load_suppliers_frame()
        if suppliers.empty:
            return suppliers

        transactions = self.dataset_service.load_full_transactions()
        esg = self.dataset_service.load_esg_frame()
        settings = self.dataset_service.settings
        audits = self.dataset_service.load_optional_csv(settings.audits_file, "audits")
        alerts = self.dataset_service.load_optional_csv(settings.alerts_file, "alerts")
        supplier_certs = self.dataset_service.load_optional_csv(
            settings.supplier_certifications_file,
            "supplier_certifications",
        )
        commodities = self.dataset_service.load_optional_csv(settings.commodities_file, "commodities")
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        supplier_features = self.dataset_service.load_optional_csv(
            settings.supplier_features_file,
            "supplier_features",
        )

        transaction_metrics = self._build_transaction_metrics(transactions)
        audit_metrics = self._build_audit_metrics(audits)
        alert_metrics = self._build_alert_metrics(alerts)
        certification_metrics = self._build_certification_metrics(supplier_certs)
        commodity_metrics = self._build_commodity_metrics(supplier_commodity_map, commodities)
        supplier_metrics = self._build_supplier_metrics(suppliers)
        esg_metrics = self._build_esg_metrics(esg)

        risk_frame = suppliers.merge(transaction_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(audit_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(alert_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(certification_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(commodity_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(supplier_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(esg_metrics, on="supplier_id", how="left")

        if not supplier_features.empty and "supplier_id" in supplier_features.columns:
            fallback_columns = [
                column
                for column in ["avg_delay", "avg_defect"]
                if column in supplier_features.columns and column not in risk_frame.columns
            ]
            if fallback_columns:
                risk_frame = risk_frame.merge(
                    supplier_features[["supplier_id", *fallback_columns]],
                    on="supplier_id",
                    how="left",
                )

        for column in [
            "avg_delay",
            "avg_defect",
            "avg_cost_variance",
            "delay_volatility",
            "defect_volatility",
            "recent_delay_risk",
            "recent_defect_risk",
            "trend_delay_risk",
            "trend_defect_risk",
            "repeat_delay_risk",
            "repeat_defect_risk",
            "dependency_score",
            "criticality_score",
            "audit_non_compliance_mean",
            "audit_score_inverse",
            "recent_audit_non_compliance",
            "recent_audit_score_inverse",
            "audit_trend_risk",
            "repeat_audit_issue_risk",
            "open_alert_severity",
            "open_alert_count",
            "critical_open_alert_risk",
            "certification_gap_score",
            "certification_recency_risk",
            "commodity_exposure_risk",
            "country_risk_score",
            "environmental_risk_score",
            "social_risk_score",
            "governance_risk_score",
        ]:
            if column not in risk_frame.columns:
                risk_frame[column] = 0.0

        neutral_defaults = {
            "avg_delay": 50.0,
            "avg_defect": 50.0,
            "avg_cost_variance": 50.0,
            "delay_volatility": 50.0,
            "defect_volatility": 50.0,
            "recent_delay_risk": 50.0,
            "recent_defect_risk": 50.0,
            "trend_delay_risk": 50.0,
            "trend_defect_risk": 50.0,
            "repeat_delay_risk": 50.0,
            "repeat_defect_risk": 50.0,
            "dependency_score": 50.0,
            "criticality_score": 50.0,
            "audit_non_compliance_mean": 50.0,
            "audit_score_inverse": 50.0,
            "recent_audit_non_compliance": 50.0,
            "recent_audit_score_inverse": 50.0,
            "audit_trend_risk": 50.0,
            "repeat_audit_issue_risk": 50.0,
            "open_alert_count": 0.0,
            "open_alert_severity": 0.0,
            "critical_open_alert_risk": 0.0,
            "certification_gap_score": 70.0,
            "certification_recency_risk": 50.0,
            "commodity_exposure_risk": 50.0,
            "country_risk_score": 50.0,
            "environmental_risk_score": 50.0,
            "social_risk_score": 50.0,
            "governance_risk_score": 50.0,
        }
        for column, default_value in neutral_defaults.items():
            risk_frame[column] = pd.to_numeric(risk_frame[column], errors="coerce").fillna(default_value)

        risk_frame["operational_risk_score"] = (
            0.09 * risk_frame["avg_delay"]
            + 0.07 * risk_frame["delay_volatility"]
            + 0.08 * risk_frame["avg_defect"]
            + 0.05 * risk_frame["defect_volatility"]
            + 0.05 * risk_frame["avg_cost_variance"]
            + 0.07 * risk_frame["recent_delay_risk"]
            + 0.06 * risk_frame["recent_defect_risk"]
            + 0.05 * risk_frame["trend_delay_risk"]
            + 0.04 * risk_frame["trend_defect_risk"]
            + 0.03 * risk_frame["repeat_delay_risk"]
            + 0.03 * risk_frame["repeat_defect_risk"]
            + 0.08 * risk_frame["dependency_score"]
            + 0.08 * risk_frame["criticality_score"]
            + 0.08 * risk_frame["audit_non_compliance_mean"]
            + 0.04 * risk_frame["audit_score_inverse"]
            + 0.06 * risk_frame["recent_audit_non_compliance"]
            + 0.04 * risk_frame["recent_audit_score_inverse"]
            + 0.04 * risk_frame["audit_trend_risk"]
            + 0.03 * risk_frame["repeat_audit_issue_risk"]
            + 0.03 * risk_frame["open_alert_count"]
            + 0.05 * risk_frame["open_alert_severity"]
            + 0.04 * risk_frame["critical_open_alert_risk"]
            + 0.05 * risk_frame["certification_gap_score"]
            + 0.03 * risk_frame["certification_recency_risk"]
            + 0.05 * risk_frame["commodity_exposure_risk"]
            + 0.04 * risk_frame["country_risk_score"]
        ).round(2)

        risk_frame["esg_risk_score"] = (
            0.40 * risk_frame["environmental_risk_score"]
            + 0.35 * risk_frame["social_risk_score"]
            + 0.25 * risk_frame["governance_risk_score"]
        ).round(2)

        dual_pressure = (
            ((risk_frame["operational_risk_score"] + risk_frame["esg_risk_score"]) / 2) * 0.05
        ).round(2)
        imbalance_pressure = (
            (
                (risk_frame["operational_risk_score"] - risk_frame["esg_risk_score"]).abs() / 100
            )
            * risk_frame[["operational_risk_score", "esg_risk_score"]].max(axis=1)
            * 0.30
        ).round(2)
        risk_frame["overall_risk_score"] = (
            0.58 * risk_frame["operational_risk_score"]
            + 0.37 * risk_frame["esg_risk_score"]
            + dual_pressure
            + imbalance_pressure
        ).clip(0, 100).round(2)
        risk_frame["risk_score"] = risk_frame["overall_risk_score"]

        risk_frame["operational_risk_level"] = risk_frame["operational_risk_score"].apply(
            self._classify_risk_level
        )
        risk_frame["esg_risk_level"] = risk_frame["esg_risk_score"].apply(self._classify_risk_level)
        risk_frame["overall_risk_level"] = risk_frame["overall_risk_score"].apply(
            self._classify_risk_level
        )

        risk_frame = risk_frame.where(pd.notna(risk_frame), None)
        with self._risk_frame_lock:
            self._risk_frame_cache = (now, risk_frame.copy(deep=True))
        return risk_frame

    def _build_transaction_metrics(self, transactions: pd.DataFrame) -> pd.DataFrame:
        if transactions.empty or "supplier_id" not in transactions.columns:
            return pd.DataFrame(columns=["supplier_id"])

        working = transactions.copy()
        working["date"] = pd.to_datetime(working.get("date"), errors="coerce")
        recent_cutoff = RISK_REFERENCE_DATE - pd.Timedelta(days=180)
        recent_transactions = working[working["date"].ge(recent_cutoff)].copy()
        if recent_transactions.empty:
            recent_transactions = working.copy()

        transaction_metrics = transactions.groupby("supplier_id").agg(
            avg_delay=("delivery_delay_days", "mean"),
            delay_volatility=("delivery_delay_days", "std"),
            avg_defect=("defect_rate", "mean"),
            defect_volatility=("defect_rate", "std"),
            avg_cost_variance=("cost_variance", lambda values: values.abs().mean()),
        ).reset_index()

        recent_metrics = recent_transactions.groupby("supplier_id").agg(
            recent_avg_delay=("delivery_delay_days", "mean"),
            recent_avg_defect=("defect_rate", "mean"),
            repeat_delay_incidents=("delivery_delay_days", lambda values: (values > 7).sum()),
            repeat_defect_incidents=("defect_rate", lambda values: (values > 0.05).sum()),
        ).reset_index()
        transaction_metrics = transaction_metrics.merge(recent_metrics, on="supplier_id", how="left")

        transaction_metrics["delay_trend_raw"] = (
            transaction_metrics["recent_avg_delay"] - transaction_metrics["avg_delay"]
        )
        transaction_metrics["defect_trend_raw"] = (
            transaction_metrics["recent_avg_defect"] - transaction_metrics["avg_defect"]
        )

        for column in [
            "avg_delay",
            "delay_volatility",
            "avg_defect",
            "defect_volatility",
            "avg_cost_variance",
        ]:
            transaction_metrics[column] = self._relative_risk_score(transaction_metrics[column])

        transaction_metrics["recent_delay_risk"] = self._relative_risk_score(
            transaction_metrics["recent_avg_delay"]
        )
        transaction_metrics["recent_defect_risk"] = self._relative_risk_score(
            transaction_metrics["recent_avg_defect"]
        )
        transaction_metrics["trend_delay_risk"] = self._relative_risk_score(
            transaction_metrics["delay_trend_raw"].clip(lower=0)
        )
        transaction_metrics["trend_defect_risk"] = self._relative_risk_score(
            transaction_metrics["defect_trend_raw"].clip(lower=0)
        )
        transaction_metrics["repeat_delay_risk"] = self._relative_risk_score(
            transaction_metrics["repeat_delay_incidents"]
        )
        transaction_metrics["repeat_defect_risk"] = self._relative_risk_score(
            transaction_metrics["repeat_defect_incidents"]
        )

        return transaction_metrics

    def _build_audit_metrics(self, audits: pd.DataFrame) -> pd.DataFrame:
        if audits.empty or "supplier_id" not in audits.columns:
            return pd.DataFrame(columns=["supplier_id"])

        working = audits.copy()
        working["audit_date"] = pd.to_datetime(working.get("audit_date"), errors="coerce")
        recent_cutoff = RISK_REFERENCE_DATE - pd.Timedelta(days=365)
        recent_audits = working[working["audit_date"].ge(recent_cutoff)].copy()
        if recent_audits.empty:
            recent_audits = working.copy()

        audit_metrics = working.groupby("supplier_id").agg(
            audit_non_compliance_mean=("non_compliance", "mean"),
            audit_score_inverse=("score", "mean"),
        ).reset_index()
        recent_metrics = recent_audits.groupby("supplier_id").agg(
            recent_audit_non_compliance=("non_compliance", "mean"),
            recent_audit_score=("score", "mean"),
            repeat_audit_issues=("non_compliance", lambda values: (values >= 3).sum()),
        ).reset_index()

        latest_audits = (
            working.sort_values("audit_date")
            .groupby("supplier_id")
            .tail(2)
            .sort_values(["supplier_id", "audit_date"])
        )
        trend_rows: list[dict] = []
        for supplier_id, group in latest_audits.groupby("supplier_id"):
            if len(group) < 2:
                trend_rows.append({"supplier_id": supplier_id, "audit_trend_raw": 0.0})
                continue
            previous = group.iloc[-2]
            latest = group.iloc[-1]
            trend_rows.append(
                {
                    "supplier_id": supplier_id,
                    "audit_trend_raw": max(
                        float(latest["non_compliance"]) - float(previous["non_compliance"]),
                        float(previous["score"]) - float(latest["score"]),
                        0.0,
                    ),
                }
            )
        audit_metrics = audit_metrics.merge(recent_metrics, on="supplier_id", how="left")
        audit_metrics = audit_metrics.merge(pd.DataFrame(trend_rows), on="supplier_id", how="left")

        audit_metrics["audit_non_compliance_mean"] = self._relative_risk_score(
            audit_metrics["audit_non_compliance_mean"]
        )
        audit_metrics["audit_score_inverse"] = self._relative_risk_score(
            audit_metrics["audit_score_inverse"],
            higher_is_better=True,
        )
        audit_metrics["recent_audit_non_compliance"] = self._relative_risk_score(
            audit_metrics["recent_audit_non_compliance"]
        )
        audit_metrics["recent_audit_score_inverse"] = self._relative_risk_score(
            audit_metrics["recent_audit_score"],
            higher_is_better=True,
        )
        audit_metrics["audit_trend_risk"] = self._relative_risk_score(
            audit_metrics["audit_trend_raw"]
        )
        audit_metrics["repeat_audit_issue_risk"] = self._relative_risk_score(
            audit_metrics["repeat_audit_issues"]
        )
        return audit_metrics

    def _build_alert_metrics(self, alerts: pd.DataFrame) -> pd.DataFrame:
        if alerts.empty or "supplier_id" not in alerts.columns:
            return pd.DataFrame(columns=["supplier_id"])

        severity_weights = {"Low": 1.0, "Medium": 2.0, "High": 3.0, "Critical": 4.0}
        alerts = alerts.copy()
        alerts["severity_weight"] = alerts["severity"].map(severity_weights).fillna(1.0)
        alerts["is_open"] = alerts["status"].astype(str).str.upper().eq("OPEN").astype(int)
        alerts["open_weighted_severity"] = alerts["severity_weight"] * alerts["is_open"]
        alerts["is_critical_open"] = (
            alerts["severity"].astype(str).str.upper().eq("CRITICAL") & alerts["is_open"].eq(1)
        ).astype(int)

        alert_metrics = alerts.groupby("supplier_id").agg(
            open_alert_count=("is_open", "sum"),
            open_alert_severity=("open_weighted_severity", "sum"),
            critical_open_alert_risk=("is_critical_open", "sum"),
        ).reset_index()
        alert_metrics["open_alert_count"] = self._relative_risk_score(
            alert_metrics["open_alert_count"]
        )
        alert_metrics["open_alert_severity"] = self._relative_risk_score(
            alert_metrics["open_alert_severity"]
        )
        alert_metrics["critical_open_alert_risk"] = self._relative_risk_score(
            alert_metrics["critical_open_alert_risk"]
        )
        return alert_metrics

    def _build_certification_metrics(self, supplier_certifications: pd.DataFrame) -> pd.DataFrame:
        if supplier_certifications.empty or "supplier_id" not in supplier_certifications.columns:
            return pd.DataFrame(columns=["supplier_id"])

        certs = supplier_certifications.copy()
        certs["status_normalized"] = certs["status"].astype(str).str.strip().str.lower()
        certs["verified_flag"] = certs["status_normalized"].eq("verified").astype(int)
        certs["pending_flag"] = certs["status_normalized"].eq("pending").astype(int)
        certs["expiry_date_parsed"] = pd.to_datetime(certs.get("expiry_date"), errors="coerce")
        certs["issue_date_parsed"] = pd.to_datetime(certs.get("issue_date"), errors="coerce")
        certs["expired_flag"] = certs["expiry_date_parsed"].lt(RISK_REFERENCE_DATE).astype(int)
        certs["days_to_expiry"] = (
            certs["expiry_date_parsed"] - RISK_REFERENCE_DATE
        ).dt.days
        certs["days_since_issue"] = (
            RISK_REFERENCE_DATE - certs["issue_date_parsed"]
        ).dt.days
        certs["expiring_soon_flag"] = certs["days_to_expiry"].between(0, 60, inclusive="both").astype(int)
        certs["certification_staleness"] = certs["days_since_issue"].clip(lower=0).fillna(0)

        cert_metrics = certs.groupby("supplier_id").agg(
            certification_count=("id", "count"),
            verified_ratio=("verified_flag", "mean"),
            pending_ratio=("pending_flag", "mean"),
            expiry_ratio=("expired_flag", "mean"),
            expiring_soon_ratio=("expiring_soon_flag", "mean"),
            certification_staleness=("certification_staleness", "mean"),
        ).reset_index()

        cert_metrics["certification_gap_score"] = (
            0.45
            * self._relative_risk_score(cert_metrics["verified_ratio"], higher_is_better=True)
            + 0.25 * self._relative_risk_score(cert_metrics["pending_ratio"])
            + 0.30 * self._relative_risk_score(cert_metrics["expiry_ratio"])
        ).round(2)
        cert_metrics["certification_recency_risk"] = (
            0.65 * self._relative_risk_score(cert_metrics["expiring_soon_ratio"])
            + 0.35 * self._relative_risk_score(cert_metrics["certification_staleness"])
        ).round(2)

        return cert_metrics[["supplier_id", "certification_gap_score", "certification_recency_risk"]]

    def _build_commodity_metrics(
        self,
        supplier_commodity_map: pd.DataFrame,
        commodities: pd.DataFrame,
    ) -> pd.DataFrame:
        if (
            supplier_commodity_map.empty
            or commodities.empty
            or "supplier_id" not in supplier_commodity_map.columns
        ):
            return pd.DataFrame(columns=["supplier_id"])

        commodity_map = supplier_commodity_map.merge(
            commodities[["commodity_id", "risk_level", "deforestation_risk_score"]],
            on="commodity_id",
            how="left",
        )
        commodity_level_weights = {"Low": 1.0, "Medium": 2.0, "High": 3.0}
        commodity_map["risk_level_weight"] = commodity_map["risk_level"].map(commodity_level_weights)
        commodity_map["volume"] = pd.to_numeric(commodity_map["volume"], errors="coerce").fillna(0.0)
        volume_by_supplier = commodity_map.groupby("supplier_id")["volume"].transform("sum").replace(0, 1)
        commodity_map["volume_share"] = commodity_map["volume"] / volume_by_supplier
        commodity_map["commodity_risk"] = (
            commodity_map["volume_share"] * commodity_map["deforestation_risk_score"].fillna(0.0) * 100
            + commodity_map["volume_share"] * commodity_map["risk_level_weight"].fillna(1.0) * 10
        )

        commodity_metrics = commodity_map.groupby("supplier_id").agg(
            commodity_exposure_risk=("commodity_risk", "sum")
        ).reset_index()
        commodity_metrics["commodity_exposure_risk"] = self._relative_risk_score(
            commodity_metrics["commodity_exposure_risk"]
        )
        return commodity_metrics

    def _build_supplier_metrics(self, suppliers: pd.DataFrame) -> pd.DataFrame:
        supplier_metrics = suppliers.copy()
        supplier_metrics["dependency_score"] = self._relative_risk_score(
            supplier_metrics.get("dependency_score", pd.Series(dtype=float))
        )
        supplier_metrics["criticality_score"] = self._relative_risk_score(
            supplier_metrics.get("criticality_score", pd.Series(dtype=float))
        )
        supplier_metrics["country_risk_score"] = supplier_metrics.get("country").apply(
            self._country_risk_score
        )
        return supplier_metrics[
            ["supplier_id", "dependency_score", "criticality_score", "country_risk_score"]
        ]

    def _build_esg_metrics(self, esg: pd.DataFrame) -> pd.DataFrame:
        if esg.empty or "supplier_id" not in esg.columns:
            return pd.DataFrame(columns=["supplier_id"])

        environmental_config = {
            "carbon": False,
            "energy": False,
            "renewable": True,
            "water": False,
            "waste": False,
            "recycle": True,
            "pollution": False,
            "land": False,
            "deforestation": False,
            "fines": False,
        }
        social_config = {
            "labor": False,
            "injury": False,
            "turnover": False,
            "diversity": True,
            "child": False,
            "hours": False,
            "audit": False,
            "complaints": False,
            "wage": True,
            "satisfaction": True,
        }
        governance_config = {
            "corruption": False,
            "compliance": True,
            "board": True,
            "transparency": True,
            "legal": False,
            "tax": False,
            "disclosure": True,
            "data": False,
            "policy": True,
            "reporting": True,
        }

        esg_metrics = esg[["supplier_id"]].copy()
        esg_metrics["environmental_risk_score"] = self._score_weighted_feature_group(
            esg,
            environmental_config,
        )
        esg_metrics["social_risk_score"] = self._score_weighted_feature_group(esg, social_config)
        esg_metrics["governance_risk_score"] = self._score_weighted_feature_group(
            esg,
            governance_config,
        )
        return esg_metrics

    def _score_weighted_feature_group(
        self,
        frame: pd.DataFrame,
        column_config: dict[str, bool],
    ) -> pd.Series:
        component_scores = []
        for column, higher_is_better in column_config.items():
            if column not in frame.columns:
                continue
            component_scores.append(
                self._relative_risk_score(frame[column], higher_is_better=higher_is_better)
            )

        if not component_scores:
            return pd.Series(0.0, index=frame.index)

        score_frame = pd.concat(component_scores, axis=1)
        return score_frame.mean(axis=1, skipna=True).fillna(0.0).round(2)

    def _relative_risk_score(
        self,
        values: pd.Series,
        higher_is_better: bool = False,
    ) -> pd.Series:
        if values.empty:
            return pd.Series(dtype=float)

        numeric_values = pd.to_numeric(values, errors="coerce")
        valid_values = numeric_values.dropna()
        if valid_values.empty:
            return pd.Series(0.0, index=values.index)

        rank_pct = valid_values.rank(method="average", pct=True) * 100
        if higher_is_better:
            rank_pct = 100 - rank_pct

        scored = pd.Series(50.0, index=values.index, dtype=float)
        scored.loc[rank_pct.index] = rank_pct.round(2)
        return scored

    def _classify_risk_level(self, score: float) -> str:
        if score >= 60:
            return "High"
        if score >= 40:
            return "Medium"
        return "Low"

    def _country_risk_score(self, country: str | None) -> float:
        if not country:
            return 50.0

        risk_map = {
            "brazil": 78.0,
            "indonesia": 82.0,
            "india": 66.0,
            "vietnam": 62.0,
            "china": 64.0,
            "thailand": 58.0,
            "malaysia": 61.0,
            "mexico": 57.0,
            "philippines": 59.0,
            "usa": 28.0,
            "germany": 24.0,
            "france": 26.0,
            "netherlands": 22.0,
            "singapore": 18.0,
            "uk": 25.0,
        }
        return risk_map.get(str(country).strip().lower(), 50.0)
