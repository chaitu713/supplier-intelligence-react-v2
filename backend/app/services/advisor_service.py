from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any, Callable
from uuid import uuid4

import pandas as pd

from ..core.exceptions import AppError
from ..core.logging import get_logger
from ..ai.guardrails import GuardrailViolation, safe_guardrail_message
from ..ai.prompt_registry import get_prompt_policy_block
from .ai_gateway import AiGatewayError
from .ai_gateway import AiTextRequest, generate_ai_text
from ..schemas.advisor import AdvisorLens, AdvisorMessageRequest, AdvisorSimulatorContext
from .dataset_service import DatasetService
from .risk_service import RiskService
from .vector_search_service import vector_search_service

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AdvisorService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()
        self.risk_service = RiskService()
        self._sessions: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._specialized_handlers: dict[
            AdvisorLens, Callable[[str, dict[str, Any]], str]
        ] = {
            "general": self._answer_general,
            "executive": self._explain_executive_posture,
            "analytics": self._summarize_analytics_context,
            "simulator": self._explain_simulator_result,
            "due_diligence": self._recommend_due_diligence_targets,
            "esg_monitoring": self._summarize_esg_monitoring_context,
        }

    def create_session(self) -> dict:
        session_id = f"chat_{uuid4().hex[:12]}"
        session = {
            "sessionId": session_id,
            "createdAt": _utcnow(),
            "messages": [],
        }

        with self._lock:
            self._sessions[session_id] = session

        logger.info("Created advisor session %s", session_id)
        return session

    def get_session(self, session_id: str) -> dict:
        with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            raise AppError("Advisor session not found", status_code=404)

        return session

    def delete_session(self, session_id: str) -> dict:
        with self._lock:
            session = self._sessions.pop(session_id, None)

        if not session:
            raise AppError("Advisor session not found", status_code=404)

        logger.info("Deleted advisor session %s", session_id)
        return {"sessionId": session_id, "deleted": True}

    def send_message(self, session_id: str, payload: AdvisorMessageRequest) -> dict:
        user_message = {
            "role": "user",
            "content": payload.message,
            "createdAt": _utcnow(),
        }

        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                raise AppError("Advisor session not found", status_code=404)
            session["messages"].append(user_message)

        reply = self._generate_reply(
            question=payload.message,
            lens=payload.lens,
            simulator_context=payload.simulatorContext,
        )
        assistant_message = {
            "role": "assistant",
            "content": reply["content"],
            "createdAt": _utcnow(),
            "source": reply["source"],
            "provider": reply.get("provider"),
            "model": reply.get("model"),
            "trace_id": reply.get("trace_id"),
            "sources": reply.get("sources") or [],
        }

        with self._lock:
            self._sessions[session_id]["messages"].append(assistant_message)

        logger.info("Generated advisor response for session %s using %s lens", session_id, payload.lens)
        return {
            "sessionId": session_id,
            "reply": assistant_message,
            "lensUsed": payload.lens,
        }

    def _generate_reply(
        self,
        question: str,
        lens: AdvisorLens,
        simulator_context: AdvisorSimulatorContext | None,
    ) -> dict[str, Any]:
        context = self._build_advisor_context(lens=lens, simulator_context=simulator_context)
        context["retrievedEvidence"] = self._retrieve_advisor_evidence(question, context)
        specialized_handler = self._specialized_handlers.get(lens, self._answer_general)
        deterministic_brief = specialized_handler(question, context)

        try:
            response = generate_ai_text(
                AiTextRequest(
                    feature="advisor",
                    prompt=self._build_advisor_prompt(question, context, lens, deterministic_brief),
                    user_input=question,
                    context=context,
                )
            )
            if response.text:
                return {
                    "content": response.text,
                    "source": "llm",
                    "provider": response.provider,
                    "model": response.model,
                    "trace_id": response.trace_id,
                    "sources": self._advisor_sources(context.get("retrievedEvidence", [])),
                }
        except GuardrailViolation as exc:
            logger.warning("Advisor prompt blocked by AI guardrails")
            raise AppError(safe_guardrail_message(exc.result), status_code=400)
        except AiGatewayError as exc:
            logger.warning("Advisor AI provider failed, using deterministic fallback: %s", exc)
        except Exception as exc:
            logger.warning("Advisor AI generation failed, using deterministic fallback: %s", exc)

        return {
            "content": deterministic_brief,
            "source": "deterministic_fallback",
            "provider": None,
            "model": None,
            "trace_id": None,
            "sources": self._advisor_sources(context.get("retrievedEvidence", [])),
        }

    def _build_advisor_prompt(
        self,
        question: str,
        context: dict[str, Any],
        lens: AdvisorLens,
        deterministic_brief: str | None,
    ) -> str:
        lens_instructions = {
            "general": "Answer like a supplier intelligence advisor who synthesizes risk, ESG, geography, audits, traceability, and sourcing posture.",
            "executive": "Answer for leadership with concise risk posture explanations and implications.",
            "analytics": "Answer like an analyst, focusing on drivers, distributions, comparisons, and evidence.",
            "simulator": "Explain what changed in the scenario, why the deltas occurred, and which supplier groups were affected.",
            "due_diligence": "Focus on follow-up actions, review priorities, supplier-level blockers, and due diligence decisions.",
            "esg_monitoring": "Focus on future continuous monitoring, ESG pillar pressure, deteriorating indicators, and monitoring implications.",
        }
        return f"""
You are Supplier Advisor AI inside a responsible sourcing and supplier intelligence application.

{get_prompt_policy_block("advisor")}

Active lens:
{lens}

Lens instruction:
{lens_instructions.get(lens, lens_instructions["general"])}

Grounding context:
{self._to_json(context)}

Retrieved evidence:
{self._to_json(context.get("retrievedEvidence", []))}

Deterministic brief:
{deterministic_brief or "None provided."}

User question:
{question}

Rules:
- Answer only from the supplied grounding context.
- Use retrieved evidence when it is relevant, and cite source titles inline in plain English.
- Use the deterministic brief as your primary answer structure, then refine it into a more natural response.
- If Supplier 360 context is present, use it to explain audit, certification, traceability, and due diligence blockers.
- If simulator context is present, use it directly instead of speaking generically.
- Mention specific suppliers, countries, commodities, or KPI deltas only when present in context.
- Keep the reply concise, structured, and decision-useful.
- Do not invent entities or metrics not present in the context.
- If the question asks for unavailable detail, say what is available instead.
"""

    def _retrieve_advisor_evidence(
        self,
        question: str,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        try:
            if not self.dataset_service.settings.rag_enabled:
                return []
            results = vector_search_service.search(
                question,
                top_k=self.dataset_service.settings.rag_top_k,
            )
        except GuardrailViolation:
            raise
        except Exception as exc:
            logger.warning("Advisor RAG retrieval unavailable; continuing without retrieved evidence: %s", exc)
            return []

        evidence = []
        for item in results:
            evidence.append(
                {
                    "title": item.title,
                    "sourceType": item.source_type,
                    "sourceId": item.source_id,
                    "score": item.score,
                    "scoreType": item.score_type,
                    "metadata": item.metadata,
                    "text": item.text[:1200],
                }
            )
        return evidence

    def _advisor_sources(self, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "title": item.get("title"),
                "sourceType": item.get("sourceType"),
                "sourceId": item.get("sourceId"),
                "score": item.get("score"),
                "scoreType": item.get("scoreType"),
                "metadata": item.get("metadata") or {},
            }
            for item in evidence
        ]

    def _to_json(self, payload: Any) -> str:
        import json

        return json.dumps(payload, indent=2, default=str)

    def _build_advisor_context(
        self,
        lens: AdvisorLens,
        simulator_context: AdvisorSimulatorContext | None,
    ) -> dict[str, Any]:
        risk_frame = self.risk_service._build_supplier_risk_frame()
        if risk_frame.empty:
            return {
                "lens": lens,
                "overview": {
                    "totalSuppliers": 0,
                    "highRiskSuppliers": 0,
                    "mediumRiskSuppliers": 0,
                    "lowRiskSuppliers": 0,
                    "avgOverallRisk": 0.0,
                    "avgOperationalRisk": 0.0,
                    "avgEsgRisk": 0.0,
                },
                "simulator": simulator_context.model_dump() if simulator_context else None,
                "topRiskSuppliers": [],
                "lowRiskSuppliers": [],
                "topEsgSuppliers": [],
                "countrySummary": [],
                "commoditySummary": [],
                "esgPillars": {
                    "environmentalAvg": 0.0,
                    "socialAvg": 0.0,
                    "governanceAvg": 0.0,
                },
            }

        working = risk_frame.copy()
        for column in [
            "overall_risk_score",
            "operational_risk_score",
            "esg_risk_score",
            "environmental_risk_score",
            "social_risk_score",
            "governance_risk_score",
        ]:
            if column in working.columns:
                working[column] = pd.to_numeric(working[column], errors="coerce").fillna(0.0)

        overview = {
            "totalSuppliers": int(len(working)),
            "highRiskSuppliers": int((working["overall_risk_level"] == "High").sum()),
            "mediumRiskSuppliers": int((working["overall_risk_level"] == "Medium").sum()),
            "lowRiskSuppliers": int((working["overall_risk_level"] == "Low").sum()),
            "avgOverallRisk": round(float(working["overall_risk_score"].mean()), 2),
            "avgOperationalRisk": round(float(working["operational_risk_score"].mean()), 2),
            "avgEsgRisk": round(float(working["esg_risk_score"].mean()), 2),
        }

        context = {
            "lens": lens,
            "overview": overview,
            "topRiskSuppliers": self._serialize_suppliers(
                working.sort_values("overall_risk_score", ascending=False).head(5)
            ),
            "lowRiskSuppliers": self._serialize_suppliers(
                working.sort_values("overall_risk_score", ascending=True).head(5)
            ),
            "topEsgSuppliers": self._serialize_suppliers(
                working.sort_values("esg_risk_score", ascending=False).head(5),
                score_column="esg_risk_score",
                level_column="esg_risk_level",
            ),
            "countrySummary": self._build_country_summary(working),
            "commoditySummary": self._build_commodity_summary(working),
            "esgPillars": {
                "environmentalAvg": round(float(working["environmental_risk_score"].mean()), 2),
                "socialAvg": round(float(working["social_risk_score"].mean()), 2),
                "governanceAvg": round(float(working["governance_risk_score"].mean()), 2),
            },
            "supplier360": self._build_supplier_360_context(working),
            "simulator": simulator_context.model_dump() if simulator_context else None,
        }
        return context

    def _build_supplier_360_context(self, risk_frame: pd.DataFrame) -> list[dict[str, Any]]:
        settings = self.dataset_service.settings
        audits = self.dataset_service.load_optional_csv(settings.audits_file, "audits")
        certs = self.dataset_service.load_optional_csv(
            settings.supplier_certifications_file,
            "supplier_certifications",
        )
        trace_gaps = self.dataset_service.load_optional_csv(
            settings.data_dir / "traceability_gap_actions_v2.csv",
            "traceability_gap_actions",
        )
        due_diligence_cases = self.dataset_service.load_optional_csv(
            settings.data_dir / "due_diligence_cases_v2.csv",
            "due_diligence_cases",
        )

        top_frame = risk_frame.sort_values("overall_risk_score", ascending=False).head(8)
        items: list[dict[str, Any]] = []
        for _, row in top_frame.iterrows():
            supplier_id = int(row.get("supplier_id"))
            supplier_audits = audits[audits.get("supplier_id").eq(supplier_id)] if not audits.empty and "supplier_id" in audits.columns else pd.DataFrame()
            supplier_certs = certs[certs.get("supplier_id").eq(supplier_id)] if not certs.empty and "supplier_id" in certs.columns else pd.DataFrame()
            supplier_trace_gaps = trace_gaps[trace_gaps.get("supplier_id").eq(supplier_id)] if not trace_gaps.empty and "supplier_id" in trace_gaps.columns else pd.DataFrame()
            supplier_dd = due_diligence_cases[due_diligence_cases.get("supplier_id").eq(supplier_id)] if not due_diligence_cases.empty and "supplier_id" in due_diligence_cases.columns else pd.DataFrame()

            latest_audit = ""
            if not supplier_audits.empty:
                latest_audit = str(supplier_audits.sort_values("audit_date").tail(1).iloc[0].get("audit_status") or "")

            cert_statuses = supplier_certs.get("status", pd.Series(dtype=str)).astype(str).str.lower() if not supplier_certs.empty else pd.Series(dtype=str)
            trace_statuses = supplier_trace_gaps.get("status", pd.Series(dtype=str)).astype(str).str.lower() if not supplier_trace_gaps.empty else pd.Series(dtype=str)

            latest_dd_decision = ""
            if not supplier_dd.empty:
                latest_dd_decision = str(supplier_dd.tail(1).iloc[0].get("decision") or "")

            items.append({
                "supplierId": supplier_id,
                "supplierName": row.get("supplier_name"),
                "country": row.get("country"),
                "tier": row.get("tier"),
                "status": row.get("status"),
                "overallRisk": round(float(row.get("overall_risk_score", 0.0) or 0.0), 2),
                "operationalRisk": round(float(row.get("operational_risk_score", 0.0) or 0.0), 2),
                "esgRisk": round(float(row.get("esg_risk_score", 0.0) or 0.0), 2),
                "latestAuditStatus": latest_audit or "No recent audit status",
                "verifiedCertifications": int(cert_statuses.eq("verified").sum()) if not cert_statuses.empty else 0,
                "pendingCertifications": int(cert_statuses.eq("pending").sum()) if not cert_statuses.empty else 0,
                "openTraceGaps": int(trace_statuses.ne("closed").sum()) if not trace_statuses.empty else 0,
                "latestDueDiligenceDecision": latest_dd_decision or "No due diligence case",
            })
        return items

    def _serialize_suppliers(
        self,
        frame: pd.DataFrame,
        score_column: str = "overall_risk_score",
        level_column: str = "overall_risk_level",
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for _, row in frame.iterrows():
            items.append(
                {
                    "supplierName": row.get("supplier_name"),
                    "country": row.get("country"),
                    "category": row.get("category"),
                    "tier": row.get("tier"),
                    "score": round(float(row.get(score_column, 0.0) or 0.0), 2),
                    "riskLevel": row.get(level_column),
                    "overallRisk": round(float(row.get("overall_risk_score", 0.0) or 0.0), 2),
                    "operationalRisk": round(float(row.get("operational_risk_score", 0.0) or 0.0), 2),
                    "esgRisk": round(float(row.get("esg_risk_score", 0.0) or 0.0), 2),
                }
            )
        return items

    def _build_country_summary(self, risk_frame: pd.DataFrame) -> list[dict[str, Any]]:
        grouped = (
            risk_frame.groupby("country", dropna=False)
            .agg(
                supplierCount=("supplier_id", "count"),
                avgOverallRisk=("overall_risk_score", "mean"),
                avgOperationalRisk=("operational_risk_score", "mean"),
                avgEsgRisk=("esg_risk_score", "mean"),
            )
            .reset_index()
            .sort_values(["supplierCount", "avgOverallRisk"], ascending=[False, False])
            .head(5)
        )

        items: list[dict[str, Any]] = []
        for _, row in grouped.iterrows():
            items.append(
                {
                    "country": row.get("country") or "Unknown",
                    "supplierCount": int(row["supplierCount"]),
                    "avgOverallRisk": round(float(row["avgOverallRisk"]), 2),
                    "avgOperationalRisk": round(float(row["avgOperationalRisk"]), 2),
                    "avgEsgRisk": round(float(row["avgEsgRisk"]), 2),
                }
            )
        return items

    def _build_commodity_summary(self, risk_frame: pd.DataFrame) -> list[dict[str, Any]]:
        supplier_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )
        if supplier_map.empty or commodities.empty:
            return []

        merged = supplier_map.merge(
            commodities[["commodity_id", "commodity_name"]],
            on="commodity_id",
            how="left",
        ).merge(
            risk_frame[
                [
                    "supplier_id",
                    "overall_risk_score",
                    "operational_risk_score",
                    "esg_risk_score",
                ]
            ],
            on="supplier_id",
            how="left",
        )

        grouped = (
            merged.groupby("commodity_name", dropna=False)
            .agg(
                supplierCount=("supplier_id", "nunique"),
                avgOverallRisk=("overall_risk_score", "mean"),
                avgOperationalRisk=("operational_risk_score", "mean"),
                avgEsgRisk=("esg_risk_score", "mean"),
            )
            .reset_index()
            .sort_values(["supplierCount", "avgOverallRisk"], ascending=[False, False])
            .head(5)
        )

        items: list[dict[str, Any]] = []
        for _, row in grouped.iterrows():
            items.append(
                {
                    "commodity": row.get("commodity_name") or "Unknown",
                    "supplierCount": int(row["supplierCount"]),
                    "avgOverallRisk": round(float(row["avgOverallRisk"]), 2),
                    "avgOperationalRisk": round(float(row["avgOperationalRisk"]), 2),
                    "avgEsgRisk": round(float(row["avgEsgRisk"]), 2),
                }
            )
        return items

    def _answer_general(self, question: str, context: dict[str, Any]) -> str:
        overview = context["overview"]
        top_supplier = self._top_item(context.get("topRiskSuppliers"))
        top_country = self._top_item(context.get("countrySummary"))
        top_commodity = self._top_item(context.get("commoditySummary"))

        lines = [
            "General Overview",
            f"- The network currently includes {overview['totalSuppliers']} suppliers with {overview['highRiskSuppliers']} high-risk suppliers and an average overall risk of {overview['avgOverallRisk']:.1f}.",
        ]
        if top_supplier:
            lines.append(
                f"- {top_supplier['supplierName']} is the highest-risk supplier in the current frame at {top_supplier['overallRisk']:.1f} overall risk."
            )
        if top_country:
            lines.append(
                f"- {top_country['country']} has the largest country concentration with {top_country['supplierCount']} suppliers."
            )
        if top_commodity:
            lines.append(
                f"- {top_commodity['commodity']} is the most concentrated commodity exposure with {top_commodity['supplierCount']} suppliers mapped to it."
            )
        supplier_360 = self._top_item(context.get("supplier360"))
        if supplier_360:
            lines.append(
                f"- Supplier 360 priority: {supplier_360['supplierName']} has {supplier_360['openTraceGaps']} open trace gaps, {supplier_360['pendingCertifications']} pending certifications, and latest due diligence decision '{supplier_360['latestDueDiligenceDecision']}'."
            )
        lines.append(f"- The current question to answer is: {question}")
        return "\n".join(lines)

    def _explain_executive_posture(self, question: str, context: dict[str, Any]) -> str:
        overview = context["overview"]
        top_supplier = self._top_item(context.get("topRiskSuppliers"))
        top_country = self._top_item(context.get("countrySummary"))
        lines = [
            "Executive Posture",
            f"- The network is operating with {overview['highRiskSuppliers']} high-risk suppliers, {overview['mediumRiskSuppliers']} medium-risk suppliers, and an average overall risk of {overview['avgOverallRisk']:.1f}.",
            f"- Operational risk averages {overview['avgOperationalRisk']:.1f}, while ESG risk averages {overview['avgEsgRisk']:.1f}.",
        ]
        if top_country:
            lines.append(
                f"- The most concentrated country exposure is {top_country['country']} with {top_country['supplierCount']} suppliers and an average overall risk of {top_country['avgOverallRisk']:.1f}."
            )
        if top_supplier:
            lines.append(
                f"- The current priority supplier is {top_supplier['supplierName']} in {top_supplier['country']} at {top_supplier['overallRisk']:.1f} overall risk."
            )
        lines.append(f"- Executive question in focus: {question}")
        return "\n".join(lines)

    def _summarize_analytics_context(self, question: str, context: dict[str, Any]) -> str:
        top_country = self._top_item(context.get("countrySummary"))
        top_commodity = self._top_item(context.get("commoditySummary"))
        top_esg = self._top_item(context.get("topEsgSuppliers"))
        pillars = context.get("esgPillars", {})

        lines = [
            "Analytics Summary",
            f"- Environmental, social, and governance averages are {pillars.get('environmentalAvg', 0.0):.1f}, {pillars.get('socialAvg', 0.0):.1f}, and {pillars.get('governanceAvg', 0.0):.1f} respectively.",
        ]
        if top_country:
            lines.append(
                f"- Country concentration is led by {top_country['country']} with {top_country['supplierCount']} suppliers and {top_country['avgOverallRisk']:.1f} average overall risk."
            )
        if top_commodity:
            lines.append(
                f"- Commodity concentration is led by {top_commodity['commodity']} with {top_commodity['supplierCount']} suppliers and {top_commodity['avgOverallRisk']:.1f} average overall risk."
            )
        if top_esg:
            lines.append(
                f"- The strongest ESG pressure is currently associated with {top_esg['supplierName']} at {top_esg['esgRisk']:.1f} ESG risk."
            )
        lines.append(f"- Analytics question in focus: {question}")
        return "\n".join(lines)

    def _explain_simulator_result(self, question: str, context: dict[str, Any]) -> str:
        simulator = context.get("simulator")
        if not simulator:
            return "Simulator Summary\n- No simulator result is currently attached to this advisor request."

        lines = [
            "Simulator Summary",
            f"- The latest scenario is {simulator['scenarioTitle']}.",
            f"- It changes high-risk suppliers by {simulator['highRiskDelta']:+.0f}, overall risk by {simulator['overallRiskDelta']:+.1f}, operational risk by {simulator['operationalRiskDelta']:+.1f}, and ESG risk by {simulator['esgRiskDelta']:+.1f}.",
            f"- {simulator['affectedSupplierCount']} suppliers are affected in this scenario.",
            f"- Simulator question in focus: {question}",
        ]
        return "\n".join(lines)

    def _recommend_due_diligence_targets(self, question: str, context: dict[str, Any]) -> str:
        top_suppliers = context.get("topRiskSuppliers", [])[:3]
        supplier_360 = context.get("supplier360", [])[:3]
        lines = [
            "Due Diligence Priorities",
            "- The strongest candidates for due diligence are the suppliers with the highest current overall risk and strongest operational or ESG pressure.",
        ]
        for item in supplier_360 or top_suppliers:
            lines.append(
                f"- {item['supplierName']} in {item['country']} should be prioritized at {item['overallRisk']:.1f} overall risk, audit status '{item.get('latestAuditStatus', 'Unknown')}', {item.get('openTraceGaps', 0)} open trace gaps, and due diligence decision '{item.get('latestDueDiligenceDecision', 'No case')}'."
            )
        lines.append(f"- Due diligence question in focus: {question}")
        return "\n".join(lines)

    def _summarize_esg_monitoring_context(self, question: str, context: dict[str, Any]) -> str:
        pillars = context.get("esgPillars", {})
        top_esg = context.get("topEsgSuppliers", [])[:3]
        highest_pillar = max(
            [
                ("Environmental", pillars.get("environmentalAvg", 0.0)),
                ("Social", pillars.get("socialAvg", 0.0)),
                ("Governance", pillars.get("governanceAvg", 0.0)),
            ],
            key=lambda item: item[1],
        )
        lines = [
            "ESG Monitoring Summary",
            f"- The highest average ESG pressure currently comes from the {highest_pillar[0].lower()} pillar at {highest_pillar[1]:.1f}.",
            f"- Pillar averages are environmental {pillars.get('environmentalAvg', 0.0):.1f}, social {pillars.get('socialAvg', 0.0):.1f}, and governance {pillars.get('governanceAvg', 0.0):.1f}.",
        ]
        for item in top_esg:
            lines.append(
                f"- {item['supplierName']} is a leading ESG monitoring candidate at {item['esgRisk']:.1f} ESG risk."
            )
        lines.append(f"- ESG monitoring question in focus: {question}")
        return "\n".join(lines)

    def _top_item(self, items: list[dict[str, Any]] | None) -> dict[str, Any] | None:
        return items[0] if items else None


advisor_service = AdvisorService()
