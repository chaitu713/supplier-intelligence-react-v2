from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any
import json
import re
import shutil
import uuid

import pandas as pd

from ..ai.guardrails import GuardrailViolation
from ..ai.output_validation import validate_trace_decision
from ..ai.prompt_registry import get_prompt_policy_block
from .ai_gateway import AiGatewayError, AiTextRequest, generate_ai_text
from .onboarding_service import onboarding_service
from .sqlite_data import csv_table_name, install_pandas_sqlite_bridge, table_exists

install_pandas_sqlite_bridge()


class TraceabilityService:
    def __init__(self) -> None:
        self.data_dir = Path(__file__).resolve().parents[3] / "data"
        self.uploads_dir = Path(__file__).resolve().parents[3] / "uploads" / "traceability" / "evidence"
        self.evidence_path = self.data_dir / "supplier_evidence_v2.csv"
        self.gap_actions_path = self.data_dir / "traceability_gap_actions_v2.csv"
        self.gap_history_path = self.data_dir / "traceability_gap_action_history_v2.csv"
        self.score_history_path = self.data_dir / "traceability_score_history_v2.csv"
        self.decisions_path = self.data_dir / "traceability_decisions_v2.csv"

    def generate_trace_decision(self, supplier_id: int) -> dict:
        trace_package = self._supplier_trace_package(supplier_id)
        fallback = self._fallback_trace_decision(trace_package)
        prompt = f"""
You are an AI-assisted traceability decision engine.

{get_prompt_policy_block("traceability")}

Allowed decisions:
- Trace Complete
- Trace Complete with Conditions
- Evidence Gap
- High-Risk Trace
- Block / Escalate

Return only valid JSON with this exact shape:
{{
  "decision": "Evidence Gap",
  "confidence": "low|medium|high",
  "rationale": ["reason"],
  "blockers": ["blocker"],
  "missingEvidence": ["missing item"],
  "nextActions": ["action"],
  "source": "llm"
}}

Rules:
- Use only the supplied trace package.
- Do not invent evidence, sites, lots, or regulatory facts.
- Use Block / Escalate when EUDR status is Blocked or there are open critical/high gaps.
- Use Trace Complete only when evidence coverage is complete, score is strong, and no open gaps remain.

Trace package:
{json.dumps(trace_package, default=str)[:8000]}
"""
        try:
            response = generate_ai_text(
                AiTextRequest(
                    feature="traceability",
                    prompt=prompt,
                    user_input=f"traceability decision for supplier {supplier_id}",
                    context=trace_package,
                    response_format="json",
                )
            )
            parsed = json.loads(self._extract_json_block(response.text.strip()))
            if not isinstance(parsed, dict):
                return fallback
            decision = self._validate_trace_decision(parsed, fallback)
            decision["source"] = "llm"
            decision["provider"] = response.provider
            decision["model"] = response.model
            self._persist_trace_decision(supplier_id, decision)
            return decision
        except (GuardrailViolation, AiGatewayError, json.JSONDecodeError, ValueError):
            self._persist_trace_decision(supplier_id, fallback)
            return fallback

    def review_trace_evidence(self, evidence_id: int, review_status: str, notes: str | None = None) -> dict:
        evidence_df = self._ensure_supplier_evidence_store()
        match = pd.to_numeric(evidence_df["evidence_id"], errors="coerce") == evidence_id
        if not match.any():
            raise Exception("Trace evidence not found")
        allowed = {"Accepted", "Rejected", "Needs Supplier Clarification", "Needs Review"}
        status = self._normalize_choice(review_status, allowed, "Needs Review")
        row_index = evidence_df.index[match][0]
        evidence_df.at[row_index, "review_status"] = status
        if notes is not None:
            existing_notes = self._clean(evidence_df.at[row_index, "validation_notes"])
            evidence_df.at[row_index, "validation_notes"] = (
                f"{existing_notes} | Reviewer: {notes.strip()}" if existing_notes else f"Reviewer: {notes.strip()}"
            )
        evidence_df.to_csv(self.evidence_path, index=False)
        supplier_id = self._optional_int(evidence_df.at[row_index, "supplier_id"])
        effects = {}
        if supplier_id is not None:
            evidence_row = self._evidence_row_to_api(evidence_df.loc[row_index].to_dict())
            effects = self._apply_evidence_review_effects(supplier_id, evidence_row, status)
            self._record_score_snapshot(supplier_id, f"Evidence review: {status}")
        return {
            "message": "Trace evidence review updated",
            "evidence": self._evidence_row_to_api(evidence_df.loc[row_index].to_dict()),
            "effects": effects,
        }

    def create_gap_action(self, payload: dict) -> dict:
        supplier_id = self._optional_int(payload.get("supplier_id"))
        if supplier_id is None:
            raise Exception("A valid supplier_id is required")

        gap_type = self._clean(payload.get("gap_type"))
        if not gap_type:
            raise Exception("gap_type is required")

        gap_df = self._ensure_gap_action_store()
        gap_id = self._next_gap_id(gap_df, supplier_id)
        row = {
            "gap_id": gap_id,
            "supplier_id": supplier_id,
            "lot_id": self._clean(payload.get("lot_id")),
            "site_id": self._clean(payload.get("site_id")),
            "gap_type": gap_type,
            "severity": self._normalize_choice(payload.get("severity"), {"Low", "Medium", "High", "Critical"}, "Medium"),
            "status": self._normalize_choice(payload.get("status"), {"Open", "In Review", "Closed"}, "Open"),
            "owner": self._clean(payload.get("owner")),
            "due_date": self._clean(payload.get("due_date")),
            "description": self._clean(payload.get("description")),
            "recommended_action": self._clean(payload.get("recommended_action")),
        }
        gap_df = pd.concat([gap_df, pd.DataFrame([row])], ignore_index=True)
        gap_df.to_csv(self.gap_actions_path, index=False)
        self._append_gap_history(gap_id, supplier_id, "Created", "", row["status"], "Gap action created")
        self._record_score_snapshot(supplier_id, f"Gap action created: {gap_type}")
        return {"message": "Trace gap action created", "gapAction": self._gap_row_to_api(row)}

    def update_gap_action(self, gap_id: str, payload: dict) -> dict:
        gap_df = self._ensure_gap_action_store()
        if gap_df.empty:
            raise Exception("No trace gap actions exist")

        match = gap_df["gap_id"].astype(str) == str(gap_id)
        if not match.any():
            raise Exception("Trace gap action not found")

        row_index = gap_df.index[match][0]
        previous_status = self._clean(gap_df.at[row_index, "status"])
        updatable_columns = {
            "lot_id",
            "site_id",
            "gap_type",
            "severity",
            "status",
            "owner",
            "due_date",
            "description",
            "recommended_action",
        }

        for column in updatable_columns:
            if column not in payload:
                continue
            value = payload.get(column)
            if column == "severity":
                value = self._normalize_choice(value, {"Low", "Medium", "High", "Critical"}, "Medium")
            elif column == "status":
                value = self._normalize_choice(value, {"Open", "In Review", "Closed"}, previous_status or "Open")
            else:
                value = self._clean(value)
            gap_df.at[row_index, column] = value

        gap_df.to_csv(self.gap_actions_path, index=False)
        current_status = self._clean(gap_df.at[row_index, "status"])
        action = "Closed" if current_status == "Closed" and previous_status != "Closed" else "Updated"
        notes = self._clean(payload.get("closure_notes")) or f"Gap action {action.lower()}"
        supplier_id = self._optional_int(gap_df.at[row_index, "supplier_id"]) or 0
        self._append_gap_history(gap_id, supplier_id, action, previous_status, current_status, notes)
        if supplier_id:
            self._record_score_snapshot(supplier_id, f"Gap action {action.lower()}: {gap_id}")

        row = gap_df.loc[row_index].to_dict()
        return {"message": f"Trace gap action {action.lower()}", "gapAction": self._gap_row_to_api(row)}

    def upload_traceability_evidence(
        self,
        file_name: str,
        file_bytes: bytes,
        supplier_id: str,
        evidence_type: str,
        linked_entity_type: str | None,
        linked_entity_id: str | None,
        linked_entity_name: str | None,
        gap_id: str | None,
    ) -> dict:
        if not file_bytes:
            raise Exception("Uploaded evidence file is empty")

        supplier_id_value = self._optional_int(supplier_id)
        if supplier_id_value is None:
            raise Exception("A valid supplier_id is required")

        saved_path = self._save_trace_evidence_file(file_name, file_bytes)
        extracted_text = self._extract_trace_text(file_bytes)
        validation_status, validation_notes = self._validate_trace_evidence(
            evidence_type=evidence_type,
            linked_entity_type=linked_entity_type,
            extracted_text=extracted_text,
        )

        evidence_df = self._ensure_supplier_evidence_store()
        evidence_id = self._next_id(evidence_df, "evidence_id")
        row = {
            "evidence_id": evidence_id,
            "supplier_id": supplier_id_value,
            "temporary_supplier_key": None,
            "evidence_type": evidence_type or "Traceability",
            "linked_entity_type": linked_entity_type or "Traceability",
            "linked_entity_name": linked_entity_name or linked_entity_id,
            "file_name": file_name,
            "local_path": str(saved_path),
            "upload_date": date.today().isoformat(),
            "document_status": "Extracted" if extracted_text else "Uploaded",
            "extracted_text_preview": extracted_text[:500],
            "extracted_certificate_name": None,
            "extracted_certificate_number": self._extract_reference_number(extracted_text),
            "extracted_issuer": self._extract_issuer(extracted_text),
            "extracted_issue_date": self._extract_first_date(extracted_text),
            "extracted_expiry_date": None,
            "extracted_scope_site": linked_entity_name or linked_entity_id,
            "validation_status": validation_status,
            "validation_notes": validation_notes,
            "review_status": "Needs Review" if validation_status == "Needs Review" else validation_status,
        }
        evidence_df = pd.concat([evidence_df, pd.DataFrame([row])], ignore_index=True)
        evidence_df.to_csv(self.evidence_path, index=False)

        updates = self._apply_trace_evidence_link(
            supplier_id=supplier_id_value,
            evidence_type=evidence_type,
            linked_entity_type=linked_entity_type,
            linked_entity_id=linked_entity_id,
            gap_id=gap_id,
            validation_status=validation_status,
        )
        self._record_score_snapshot(supplier_id_value, f"Evidence uploaded: {evidence_type or 'Traceability'}")

        return {
            "message": "Traceability evidence uploaded",
            "evidence": row,
            "linkUpdates": updates,
        }

    def get_workspace_data(self) -> dict:
        suppliers_df = self._read_csv("suppliers_v2.csv")
        supplier_commodity_map_df = self._read_csv("supplier_commodity_map_v2.csv")
        commodities_df = self._read_csv("commodities_v2.csv")
        supplier_certifications_df = self._read_csv("supplier_certifications_v2.csv")
        certifications_df = self._read_csv("certifications_v2.csv")
        evidence_df = self._read_csv("supplier_evidence_v2.csv")
        sites_df = self._read_csv("supplier_sites_v2.csv")
        site_polygon_lookup = self._load_site_polygon_lookup()
        lots_df = self._read_csv("traceability_lots_v2.csv")
        events_df = self._read_csv("traceability_events_v2.csv")
        gap_actions_df = self._read_csv("traceability_gap_actions_v2.csv")

        suppliers_df = suppliers_df.astype(object)
        suppliers_df["parent_supplier_id"] = pd.to_numeric(
            suppliers_df.get("parent_supplier_id"), errors="coerce"
        ).apply(lambda value: None if pd.isna(value) else int(value))

        commodity_lookup = commodities_df.set_index("commodity_id").to_dict(orient="index")
        certification_lookup = certifications_df.set_index("cert_id").to_dict(orient="index")
        supplier_lookup = {
            int(row["supplier_id"]): {
                "supplierId": int(row["supplier_id"]),
                "supplierName": self._clean(row.get("supplier_name")),
                "country": self._clean(row.get("country")),
                "tier": self._clean(row.get("tier")),
                "parentSupplierId": row.get("parent_supplier_id"),
                "eudrRelevant": self._clean(row.get("eudr_relevant")),
                "traceabilityRequired": self._clean(row.get("traceability_required")),
                "plotTraceabilityAvailable": self._clean(row.get("plot_traceability_available")),
                "geolocationEvidenceAvailable": self._clean(row.get("geolocation_evidence_available")),
                "chainOfCustodyAvailable": self._clean(row.get("chain_of_custody_available")),
                "deforestationDeclarationAvailable": self._clean(row.get("deforestation_declaration_available")),
            }
            for _, row in suppliers_df.iterrows()
        }

        commodity_groups = self._groups(supplier_commodity_map_df, "supplier_id")
        certification_groups = self._groups(supplier_certifications_df, "supplier_id")
        site_groups = self._groups(sites_df, "supplier_id")
        lot_groups = self._groups(lots_df, "supplier_id")
        event_groups = self._groups(events_df, "supplier_id")
        gap_groups = self._groups(gap_actions_df, "supplier_id")
        evidence_groups = self._groups(evidence_df, "supplier_id")
        lot_event_groups = self._groups(events_df, "lot_id")
        commodity_name_map = self._build_commodity_name_map(commodity_groups, commodity_lookup)

        supplier_rows: list[dict] = []
        for _, supplier in suppliers_df.iterrows():
            supplier_id = int(supplier["supplier_id"])
            if supplier_id not in commodity_groups.groups:
                continue

            commodities = self._build_commodities(
                commodity_groups.get_group(supplier_id),
                commodity_lookup,
            )
            certifications = self._build_certifications(
                certification_groups.get_group(supplier_id)
                if supplier_id in certification_groups.groups
                else pd.DataFrame(),
                certification_lookup,
            )
            upstream_chain = self._build_upstream_chain(
                supplier_id=supplier_id,
                supplier_lookup=supplier_lookup,
                commodity_name_map=commodity_name_map,
            )
            sites = self._build_sites(
                site_groups.get_group(supplier_id) if supplier_id in site_groups.groups else pd.DataFrame(),
                site_polygon_lookup,
            )
            lots = self._build_lots(
                lot_groups.get_group(supplier_id) if supplier_id in lot_groups.groups else pd.DataFrame(),
                commodity_lookup,
                lot_event_groups,
            )
            events = self._build_events(
                event_groups.get_group(supplier_id) if supplier_id in event_groups.groups else pd.DataFrame()
            )
            gap_actions = self._build_gap_actions(
                gap_groups.get_group(supplier_id) if supplier_id in gap_groups.groups else pd.DataFrame()
            )
            evidence_coverage = self._build_evidence_coverage(
                supplier_lookup[supplier_id],
                certifications,
                sites,
                lots,
                events,
                gap_actions,
                evidence_groups.get_group(supplier_id) if supplier_id in evidence_groups.groups else pd.DataFrame(),
            )
            evidence_records = self._build_evidence_records(
                evidence_groups.get_group(supplier_id) if supplier_id in evidence_groups.groups else pd.DataFrame()
            )
            gap_history = self._build_gap_history_for_supplier(supplier_id)
            score_history = self._build_score_history_for_supplier(supplier_id)
            latest_decision = self._build_latest_decision_for_supplier(supplier_id)
            traceability_score = self._derive_traceability_score(
                commodities,
                certifications,
                sites,
                lots,
                events,
                gap_actions,
                evidence_coverage,
            )
            eudr_readiness = self._derive_eudr_readiness(
                supplier_lookup[supplier_id],
                commodities,
                sites,
                events,
                gap_actions,
                traceability_score,
            )

            supplier_rows.append(
                {
                    "supplierId": supplier_id,
                    "supplierName": self._clean(supplier.get("supplier_name")),
                    "country": self._clean(supplier.get("country")),
                    "tier": self._clean(supplier.get("tier")),
                    "parentSupplierId": supplier.get("parent_supplier_id"),
                    "upstreamChain": upstream_chain,
                    "commodities": commodities,
                    "certifications": certifications,
                    "sites": sites,
                    "lots": lots,
                    "events": events,
                    "evidenceCoverage": evidence_coverage,
                    "evidenceRecords": evidence_records,
                    "gapActions": gap_actions,
                    "gapHistory": gap_history,
                    "traceabilityScore": traceability_score,
                    "scoreHistory": score_history,
                    "latestDecision": latest_decision,
                    "eudrReadiness": eudr_readiness,
                }
            )

        return {
            "suppliers": supplier_rows,
            "workspaceSummary": self._build_workspace_summary(supplier_rows),
        }

    def _read_csv(self, filename: str) -> pd.DataFrame:
        path = self.data_dir / filename
        table_name = csv_table_name(path)
        if not path.exists() and not (table_name and table_exists(table_name)):
            return pd.DataFrame()
        return pd.read_csv(path)

    def _load_site_polygon_lookup(self) -> dict[str, dict]:
        path = self.data_dir / "site_polygons_v2.geojson"
        if not path.exists():
            return {}
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

        lookup: dict[str, dict] = {}
        for feature in payload.get("features", []):
            properties = feature.get("properties") or {}
            site_id = self._clean(properties.get("site_id"))
            geometry = feature.get("geometry") or {}
            if not site_id or geometry.get("type") != "Polygon":
                continue
            lookup[site_id] = {
                "polygonId": self._clean(properties.get("polygon_id")),
                "evidenceStatus": self._clean(properties.get("evidence_status")),
                "geometryType": geometry.get("type"),
                "coordinates": geometry.get("coordinates") or [],
            }
        return lookup

    def _ensure_gap_action_store(self) -> pd.DataFrame:
        columns = [
            "gap_id",
            "supplier_id",
            "lot_id",
            "site_id",
            "gap_type",
            "severity",
            "status",
            "owner",
            "due_date",
            "description",
            "recommended_action",
        ]
        gap_table = csv_table_name(self.gap_actions_path)
        if self.gap_actions_path.exists() or (gap_table and table_exists(gap_table)):
            gap_df = pd.read_csv(self.gap_actions_path)
            for column in columns:
                if column not in gap_df.columns:
                    gap_df[column] = None
            return gap_df[columns]
        gap_df = pd.DataFrame(columns=columns)
        gap_df.to_csv(self.gap_actions_path, index=False)
        return gap_df

    def _append_gap_history(
        self,
        gap_id: str,
        supplier_id: int,
        action: str,
        previous_status: str,
        new_status: str,
        notes: str,
    ) -> None:
        columns = [
            "history_id",
            "gap_id",
            "supplier_id",
            "action",
            "previous_status",
            "new_status",
            "notes",
            "action_date",
        ]
        gap_history_table = csv_table_name(self.gap_history_path)
        if self.gap_history_path.exists() or (gap_history_table and table_exists(gap_history_table)):
            history_df = pd.read_csv(self.gap_history_path)
            for column in columns:
                if column not in history_df.columns:
                    history_df[column] = None
            history_df = history_df[columns]
        else:
            history_df = pd.DataFrame(columns=columns)
        row = {
            "history_id": self._next_id(history_df, "history_id"),
            "gap_id": gap_id,
            "supplier_id": supplier_id,
            "action": action,
            "previous_status": previous_status,
            "new_status": new_status,
            "notes": notes,
            "action_date": date.today().isoformat(),
        }
        history_df = pd.concat([history_df, pd.DataFrame([row])], ignore_index=True)
        history_df.to_csv(self.gap_history_path, index=False)

    def _record_score_snapshot(self, supplier_id: int, trigger: str) -> None:
        try:
            trace_package = self._supplier_trace_package(supplier_id)
        except Exception:
            return
        score = trace_package.get("traceabilityScore") or {}
        eudr = trace_package.get("eudrReadiness") or {}
        columns = [
            "snapshot_id",
            "supplier_id",
            "snapshot_date",
            "traceability_score",
            "score_level",
            "eudr_status",
            "open_gap_count",
            "coverage_percent",
            "trigger",
        ]
        score_history_table = csv_table_name(self.score_history_path)
        if self.score_history_path.exists() or (score_history_table and table_exists(score_history_table)):
            history_df = pd.read_csv(self.score_history_path)
            for column in columns:
                if column not in history_df.columns:
                    history_df[column] = None
            history_df = history_df[columns]
        else:
            history_df = pd.DataFrame(columns=columns)
        row = {
            "snapshot_id": self._next_id(history_df, "snapshot_id"),
            "supplier_id": supplier_id,
            "snapshot_date": date.today().isoformat(),
            "traceability_score": score.get("value"),
            "score_level": score.get("level"),
            "eudr_status": eudr.get("status"),
            "open_gap_count": len(self._open_gap_actions(trace_package.get("gapActions") or [])),
            "coverage_percent": (trace_package.get("evidenceCoverage") or {}).get("coveragePercent"),
            "trigger": trigger,
        }
        history_df = pd.concat([history_df, pd.DataFrame([row])], ignore_index=True)
        history_df.to_csv(self.score_history_path, index=False)

    def _build_gap_history_for_supplier(self, supplier_id: int) -> list[dict]:
        gap_history_table = csv_table_name(self.gap_history_path)
        if not self.gap_history_path.exists() and not (gap_history_table and table_exists(gap_history_table)):
            return []
        df = pd.read_csv(self.gap_history_path)
        if df.empty or "supplier_id" not in df.columns:
            return []
        rows = df[pd.to_numeric(df["supplier_id"], errors="coerce") == supplier_id]
        return [
            {
                "historyId": self._optional_int(row.get("history_id")),
                "gapId": self._clean(row.get("gap_id")),
                "action": self._clean(row.get("action")),
                "previousStatus": self._clean(row.get("previous_status")),
                "newStatus": self._clean(row.get("new_status")),
                "notes": self._clean(row.get("notes")),
                "actionDate": self._clean(row.get("action_date")),
            }
            for _, row in rows.iterrows()
        ]

    def _build_score_history_for_supplier(self, supplier_id: int) -> list[dict]:
        score_history_table = csv_table_name(self.score_history_path)
        if not self.score_history_path.exists() and not (score_history_table and table_exists(score_history_table)):
            return []
        df = pd.read_csv(self.score_history_path)
        if df.empty or "supplier_id" not in df.columns:
            return []
        rows = df[pd.to_numeric(df["supplier_id"], errors="coerce") == supplier_id].tail(10)
        return [
            {
                "snapshotId": self._optional_int(row.get("snapshot_id")),
                "snapshotDate": self._clean(row.get("snapshot_date")),
                "traceabilityScore": self._optional_float(row.get("traceability_score")),
                "scoreLevel": self._clean(row.get("score_level")),
                "eudrStatus": self._clean(row.get("eudr_status")),
                "openGapCount": self._optional_int(row.get("open_gap_count")),
                "coveragePercent": self._optional_float(row.get("coverage_percent")),
                "trigger": self._clean(row.get("trigger")),
            }
            for _, row in rows.iterrows()
        ]

    def _persist_trace_decision(self, supplier_id: int, decision: dict) -> None:
        columns = [
            "decision_id",
            "supplier_id",
            "decision_date",
            "decision",
            "confidence",
            "rationale_json",
            "blockers_json",
            "missing_evidence_json",
            "next_actions_json",
            "source",
            "provider",
            "model",
        ]
        decisions_table = csv_table_name(self.decisions_path)
        if self.decisions_path.exists() or (decisions_table and table_exists(decisions_table)):
            decisions_df = pd.read_csv(self.decisions_path)
            for column in columns:
                if column not in decisions_df.columns:
                    decisions_df[column] = None
            decisions_df = decisions_df[columns]
        else:
            decisions_df = pd.DataFrame(columns=columns)
        row = {
            "decision_id": self._next_id(decisions_df, "decision_id"),
            "supplier_id": supplier_id,
            "decision_date": date.today().isoformat(),
            "decision": self._clean(decision.get("decision")),
            "confidence": self._clean(decision.get("confidence")),
            "rationale_json": json.dumps(decision.get("rationale") or []),
            "blockers_json": json.dumps(decision.get("blockers") or []),
            "missing_evidence_json": json.dumps(decision.get("missingEvidence") or []),
            "next_actions_json": json.dumps(decision.get("nextActions") or []),
            "source": self._clean(decision.get("source")),
            "provider": self._clean(decision.get("provider")),
            "model": self._clean(decision.get("model")),
        }
        decisions_df = pd.concat([decisions_df, pd.DataFrame([row])], ignore_index=True)
        decisions_df.to_csv(self.decisions_path, index=False)

    def _build_latest_decision_for_supplier(self, supplier_id: int) -> dict | None:
        decisions_table = csv_table_name(self.decisions_path)
        if not self.decisions_path.exists() and not (decisions_table and table_exists(decisions_table)):
            return None
        decisions_df = pd.read_csv(self.decisions_path)
        if decisions_df.empty or "supplier_id" not in decisions_df.columns:
            return None
        rows = decisions_df[pd.to_numeric(decisions_df["supplier_id"], errors="coerce") == supplier_id]
        if rows.empty:
            return None
        row = rows.iloc[-1]
        return {
            "decisionId": self._optional_int(row.get("decision_id")),
            "decisionDate": self._clean(row.get("decision_date")),
            "decision": self._clean(row.get("decision")),
            "confidence": self._clean(row.get("confidence")),
            "rationale": self._json_list(row.get("rationale_json")),
            "blockers": self._json_list(row.get("blockers_json")),
            "missingEvidence": self._json_list(row.get("missing_evidence_json")),
            "nextActions": self._json_list(row.get("next_actions_json")),
            "source": self._clean(row.get("source")),
            "provider": self._clean(row.get("provider")),
            "model": self._clean(row.get("model")),
        }

    def _apply_evidence_review_effects(self, supplier_id: int, evidence: dict, review_status: str) -> dict:
        linked_entity_id = self._extract_linked_entity_id(evidence)
        linked_type = evidence.get("linkedEntityType") or evidence.get("evidenceType")
        evidence_type = evidence.get("evidenceType")
        effects: dict[str, Any] = {}
        if review_status == "Accepted" and linked_entity_id:
            effects = self._apply_trace_evidence_link(
                supplier_id=supplier_id,
                evidence_type=evidence_type,
                linked_entity_type=linked_type,
                linked_entity_id=linked_entity_id,
                gap_id=None,
                validation_status="Complete",
            )
        elif review_status in {"Rejected", "Needs Supplier Clarification"}:
            gap_type = "Rejected trace evidence" if review_status == "Rejected" else "Evidence clarification required"
            gap = self.create_gap_action(
                {
                    "supplier_id": supplier_id,
                    "gap_type": gap_type,
                    "severity": "High" if review_status == "Rejected" else "Medium",
                    "status": "Open",
                    "description": f"{evidence.get('fileName') or 'Evidence'} marked {review_status}.",
                    "recommended_action": "Request corrected evidence from supplier and re-review.",
                }
            )
            effects["gapAction"] = gap.get("gapAction")
        return effects

    def _extract_linked_entity_id(self, evidence: dict) -> str | None:
        candidates = [
            evidence.get("linkedEntityName"),
            evidence.get("extractedScopeSite"),
            evidence.get("fileName"),
        ]
        for value in candidates:
            text = self._clean(value)
            if not text:
                continue
            paren_match = re.search(r"\(([A-Z]+-[A-Z0-9-]+)\)", text)
            if paren_match:
                return paren_match.group(1)
            direct_match = re.search(r"\b(SITE-\d{4}-\d{2}|LOT-\d{4}-[A-Z]{2}-\d{3}|EVT-\d{4}-\d{3})\b", text)
            if direct_match:
                return direct_match.group(1)
        return None

    def _json_list(self, value: Any) -> list[str]:
        try:
            parsed = json.loads(self._clean(value) or "[]")
        except json.JSONDecodeError:
            return []
        if not isinstance(parsed, list):
            return []
        return [str(item) for item in parsed]

    def _next_gap_id(self, gap_df: pd.DataFrame, supplier_id: int) -> str:
        prefix = f"GAP-{supplier_id}-"
        max_suffix = 0
        if not gap_df.empty and "gap_id" in gap_df.columns:
            for value in gap_df["gap_id"].dropna().astype(str):
                if value.startswith(prefix):
                    suffix_text = value.removeprefix(prefix)
                    if suffix_text.isdigit():
                        max_suffix = max(max_suffix, int(suffix_text))
        return f"{prefix}{max_suffix + 1:03d}"

    def _gap_row_to_api(self, row: dict | pd.Series) -> dict:
        return {
            "gapId": self._clean(row.get("gap_id")),
            "supplierId": self._optional_int(row.get("supplier_id")),
            "lotId": self._clean(row.get("lot_id")),
            "siteId": self._clean(row.get("site_id")),
            "gapType": self._clean(row.get("gap_type")),
            "severity": self._clean(row.get("severity")) or "Medium",
            "status": self._clean(row.get("status")) or "Open",
            "owner": self._clean(row.get("owner")),
            "dueDate": self._clean(row.get("due_date")),
            "description": self._clean(row.get("description")),
            "recommendedAction": self._clean(row.get("recommended_action")),
        }

    def _build_evidence_records(self, rows: pd.DataFrame) -> list[dict]:
        if rows.empty:
            return []
        return [self._evidence_row_to_api(row) for _, row in rows.iterrows()]

    def _evidence_row_to_api(self, row: dict | pd.Series) -> dict:
        return {
            "evidenceId": self._optional_int(row.get("evidence_id")),
            "supplierId": self._optional_int(row.get("supplier_id")),
            "evidenceType": self._clean(row.get("evidence_type")),
            "linkedEntityType": self._clean(row.get("linked_entity_type")),
            "linkedEntityName": self._clean(row.get("linked_entity_name")),
            "fileName": self._clean(row.get("file_name")),
            "localPath": self._clean(row.get("local_path")),
            "uploadDate": self._clean(row.get("upload_date")),
            "documentStatus": self._clean(row.get("document_status")),
            "extractedTextPreview": self._clean(row.get("extracted_text_preview")),
            "validationStatus": self._clean(row.get("validation_status")),
            "validationNotes": self._clean(row.get("validation_notes")),
            "reviewStatus": self._clean(row.get("review_status")),
        }

    def _normalize_choice(self, value: Any, allowed: set[str], fallback: str) -> str:
        cleaned = self._clean(value)
        if cleaned in allowed:
            return cleaned
        lowered = cleaned.lower()
        for candidate in allowed:
            if candidate.lower() == lowered:
                return candidate
        return fallback

    def _supplier_trace_package(self, supplier_id: int) -> dict:
        workspace = self.get_workspace_data()
        for supplier in workspace.get("suppliers", []):
            if supplier.get("supplierId") == supplier_id:
                return supplier
        raise Exception("Supplier trace package not found")

    def _fallback_trace_decision(self, trace_package: dict) -> dict:
        score = trace_package.get("traceabilityScore", {}).get("value", 0)
        eudr_status = trace_package.get("eudrReadiness", {}).get("status", "Not Required")
        coverage = trace_package.get("evidenceCoverage", {})
        open_gaps = self._open_gap_actions(trace_package.get("gapActions") or [])
        high_gaps = [gap for gap in open_gaps if gap.get("severity") in {"Critical", "High"}]
        missing_evidence = []
        if coverage.get("missingGeoEvidenceCount", 0):
            missing_evidence.append("Geolocation evidence")
        if coverage.get("missingPolygonEvidenceCount", 0):
            missing_evidence.append("Polygon evidence")
        if coverage.get("certificationGapCount", 0):
            missing_evidence.append("Current certification support")
        if coverage.get("coveragePercent", 0) < 100:
            missing_evidence.append("Complete lot/event evidence coverage")

        if eudr_status == "Blocked" or high_gaps:
            decision = "Block / Escalate"
            confidence = "high"
        elif score < 55:
            decision = "High-Risk Trace"
            confidence = "medium"
        elif open_gaps or missing_evidence:
            decision = "Evidence Gap"
            confidence = "medium"
        elif score < 80:
            decision = "Trace Complete with Conditions"
            confidence = "medium"
        else:
            decision = "Trace Complete"
            confidence = "high"

        return {
            "decision": decision,
            "confidence": confidence,
            "rationale": [
                f"Traceability score is {score}.",
                f"EUDR readiness status is {eudr_status}.",
                f"{len(open_gaps)} open trace gap actions remain.",
            ],
            "blockers": [gap.get("gapType") for gap in high_gaps][:5],
            "missingEvidence": missing_evidence[:5],
            "nextActions": [
                "Close open trace gap actions after reviewer acceptance.",
                "Upload or review missing trace evidence for linked sites, lots, and events.",
            ],
            "source": "deterministic_fallback",
        }

    def _validate_trace_decision(self, parsed: dict, fallback: dict) -> dict:
        return validate_trace_decision(parsed, fallback)

    def _string_list(self, value: Any, fallback: list[str]) -> list[str]:
        if not isinstance(value, list):
            return fallback[:5]
        return [str(item) for item in value if str(item).strip()][:5]

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

    def _save_trace_evidence_file(self, file_name: str, file_bytes: bytes) -> Path:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", file_name).strip("_") or "traceability_evidence"
        target_path = self.uploads_dir / f"{uuid.uuid4().hex}_{safe_name}"
        with target_path.open("wb") as target:
            target.write(file_bytes)
        return target_path

    def _extract_trace_text(self, file_bytes: bytes) -> str:
        try:
            return onboarding_service.extract_text(file_bytes)
        except Exception:
            return ""

    def _validate_trace_evidence(
        self,
        evidence_type: str | None,
        linked_entity_type: str | None,
        extracted_text: str,
    ) -> tuple[str, str]:
        lowered_text = extracted_text.lower()
        normalized_type = f"{evidence_type or ''} {linked_entity_type or ''}".lower()
        if not extracted_text.strip():
            return "Needs Review", "Document text could not be extracted for automated trace evidence validation"
        if any(signal in lowered_text for signal in ["expired", "missing", "not verified", "unresolved"]):
            return "Needs Review", "Trace evidence contains gap or follow-up signals"

        def has_any(keywords: list[str]) -> bool:
            return any(keyword in lowered_text for keyword in keywords)

        checks: list[tuple[str, bool]] = []
        if "plot" in normalized_type or "farm" in normalized_type:
            checks = [
                ("farm or plot identifier", has_any(["plot id", "farm id", "farm block", "traceability id"])),
                ("supplier or producer linkage", has_any(["supplier", "producer", "farm owner", "smallholder"])),
                ("commodity scope", has_any(["palm oil", "cocoa", "coffee", "rubber", "wood", "soya"])),
            ]
        elif "geo" in normalized_type or "polygon" in normalized_type:
            coordinate_pattern = re.compile(r"-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}")
            checks = [
                ("coordinate or polygon reference", bool(coordinate_pattern.search(extracted_text)) or has_any(["polygon", "geojson", "latitude", "longitude"])),
                ("site or plot linkage", has_any(["site id", "plot id", "farm boundary", "polygon reference"])),
            ]
        elif "custody" in normalized_type or "chain" in normalized_type:
            checks = [
                ("chain-of-custody reference", has_any(["chain of custody", "chain-of-custody", "custody"])),
                ("lot or batch identifier", has_any(["lot id", "lot-", "batch id", "shipment id", "shipment reference"])),
                ("inbound or outbound linkage", has_any(["inbound", "outbound", "origin", "destination", "traceability link"])),
            ]
        elif "shipment" in normalized_type or "lot" in normalized_type:
            checks = [
                ("lot or shipment reference", has_any(["lot id", "lot-", "lot code", "shipment id", "shipment reference"])),
                ("quantity or unit", has_any([" mt", " metric ton", "quantity", "volume"])),
                ("origin or destination", has_any(["origin", "destination", "from site", "to site"])),
            ]
        elif "deforestation" in normalized_type:
            checks = [
                ("deforestation-free statement", has_any(["deforestation-free", "deforestation free"])),
                ("cutoff or assessment date", has_any(["cutoff", "cut-off", "assessment date", "declaration date"])),
                ("supplier or commodity scope", has_any(["supplier", "scope", "palm oil", "cocoa", "coffee", "rubber", "wood", "soya"])),
            ]

        missing = [label for label, passed in checks if not passed]
        if missing:
            return "Needs Review", "; ".join(f"Missing {label}" for label in missing)
        if checks:
            return "Complete", f"{evidence_type or 'Traceability'} evidence passed trace-specific checks"
        return "Complete", "Traceability evidence uploaded and extracted"

    def _ensure_supplier_evidence_store(self) -> pd.DataFrame:
        columns = [
            "evidence_id",
            "supplier_id",
            "temporary_supplier_key",
            "evidence_type",
            "linked_entity_type",
            "linked_entity_name",
            "file_name",
            "local_path",
            "upload_date",
            "document_status",
            "extracted_text_preview",
            "extracted_certificate_name",
            "extracted_certificate_number",
            "extracted_issuer",
            "extracted_issue_date",
            "extracted_expiry_date",
            "extracted_scope_site",
            "validation_status",
            "validation_notes",
            "review_status",
        ]
        evidence_table = csv_table_name(self.evidence_path)
        if self.evidence_path.exists() or (evidence_table and table_exists(evidence_table)):
            evidence_df = pd.read_csv(self.evidence_path)
            for column in columns:
                if column not in evidence_df.columns:
                    evidence_df[column] = None
            return evidence_df[columns]
        evidence_df = pd.DataFrame(columns=columns)
        evidence_df.to_csv(self.evidence_path, index=False)
        return evidence_df

    def _apply_trace_evidence_link(
        self,
        supplier_id: int,
        evidence_type: str | None,
        linked_entity_type: str | None,
        linked_entity_id: str | None,
        gap_id: str | None,
        validation_status: str,
    ) -> dict:
        updates: dict[str, Any] = {}
        is_complete = validation_status == "Complete"
        normalized_type = (linked_entity_type or evidence_type or "").lower()
        if linked_entity_id:
            if "site" in normalized_type or "plot" in normalized_type or "farm" in normalized_type:
                updates["site"] = self._update_site_evidence(linked_entity_id, evidence_type, is_complete)
            elif "lot" in normalized_type or "shipment" in normalized_type:
                updates["lot"] = self._update_lot_evidence(linked_entity_id, is_complete)
            elif "event" in normalized_type or "custody" in normalized_type:
                updates["event"] = self._update_event_evidence(linked_entity_id, is_complete)

        if gap_id:
            updates["gapAction"] = self._update_gap_action(gap_id, is_complete)
        if is_complete:
            updates["supplierTraceFlags"] = self._update_supplier_trace_flags(supplier_id, evidence_type)
        return updates

    def _update_site_evidence(self, site_id: str, evidence_type: str | None, is_complete: bool) -> dict:
        path = self.data_dir / "supplier_sites_v2.csv"
        df = self._read_csv("supplier_sites_v2.csv")
        if df.empty or "site_id" not in df.columns:
            return {"updated": False, "reason": "No site store found"}
        match = df["site_id"].astype(str) == str(site_id)
        if not match.any():
            return {"updated": False, "reason": "Site not found"}
        status = "Available" if is_complete else "Needs Review"
        normalized_type = (evidence_type or "").lower()
        if "geo" in normalized_type:
            df.loc[match, "geo_evidence_status"] = status
        if "polygon" in normalized_type or "plot" in normalized_type or "farm" in normalized_type:
            df.loc[match, "polygon_evidence_status"] = status
        df.loc[match, "last_verified_date"] = date.today().isoformat()
        df.to_csv(path, index=False)
        return {"updated": True, "siteId": site_id, "status": status}

    def _update_lot_evidence(self, lot_id: str, is_complete: bool) -> dict:
        path = self.data_dir / "traceability_lots_v2.csv"
        df = self._read_csv("traceability_lots_v2.csv")
        if df.empty or "lot_id" not in df.columns:
            return {"updated": False, "reason": "No lot store found"}
        match = df["lot_id"].astype(str) == str(lot_id)
        if not match.any():
            return {"updated": False, "reason": "Lot not found"}
        df.loc[match, "evidence_status"] = "Complete" if is_complete else "Partial"
        df.to_csv(path, index=False)
        return {"updated": True, "lotId": lot_id, "status": "Complete" if is_complete else "Partial"}

    def _update_event_evidence(self, event_id: str, is_complete: bool) -> dict:
        path = self.data_dir / "traceability_events_v2.csv"
        df = self._read_csv("traceability_events_v2.csv")
        if df.empty or "event_id" not in df.columns:
            return {"updated": False, "reason": "No event store found"}
        match = df["event_id"].astype(str) == str(event_id)
        if not match.any():
            return {"updated": False, "reason": "Event not found"}
        df.loc[match, "evidence_status"] = "Available" if is_complete else "Needs Review"
        df.to_csv(path, index=False)
        return {"updated": True, "eventId": event_id, "status": "Available" if is_complete else "Needs Review"}

    def _update_gap_action(self, gap_id: str, is_complete: bool) -> dict:
        path = self.data_dir / "traceability_gap_actions_v2.csv"
        df = self._read_csv("traceability_gap_actions_v2.csv")
        if df.empty or "gap_id" not in df.columns:
            return {"updated": False, "reason": "No gap action store found"}
        match = df["gap_id"].astype(str) == str(gap_id)
        if not match.any():
            return {"updated": False, "reason": "Gap action not found"}
        df.loc[match, "status"] = "In Review" if is_complete else "Open"
        df.to_csv(path, index=False)
        return {"updated": True, "gapId": gap_id, "status": "In Review" if is_complete else "Open"}

    def _update_supplier_trace_flags(self, supplier_id: int, evidence_type: str | None) -> dict:
        path = self.data_dir / "suppliers_v2.csv"
        df = self._read_csv("suppliers_v2.csv")
        if df.empty or "supplier_id" not in df.columns:
            return {"updated": False, "reason": "No supplier store found"}
        match = pd.to_numeric(df["supplier_id"], errors="coerce") == supplier_id
        if not match.any():
            return {"updated": False, "reason": "Supplier not found"}
        normalized_type = (evidence_type or "").lower()
        changed: list[str] = []
        if "plot" in normalized_type or "farm" in normalized_type:
            df.loc[match, "plot_traceability_available"] = "Yes"
            changed.append("plot_traceability_available")
        if "geo" in normalized_type or "polygon" in normalized_type:
            df.loc[match, "geolocation_evidence_available"] = "Yes"
            changed.append("geolocation_evidence_available")
        if "custody" in normalized_type or "shipment" in normalized_type or "lot" in normalized_type:
            df.loc[match, "chain_of_custody_available"] = "Yes"
            changed.append("chain_of_custody_available")
        if "deforestation" in normalized_type:
            df.loc[match, "deforestation_declaration_available"] = "Yes"
            changed.append("deforestation_declaration_available")
        if changed:
            df.to_csv(path, index=False)
        return {"updated": bool(changed), "supplierId": supplier_id, "changed": changed}

    def _next_id(self, df: pd.DataFrame, column: str) -> int:
        if df.empty or column not in df.columns:
            return 1
        numeric_values = pd.to_numeric(df[column], errors="coerce").dropna()
        if numeric_values.empty:
            return 1
        return int(numeric_values.max()) + 1

    def _extract_reference_number(self, text: str) -> str | None:
        match = re.search(r"(?:reference|ref|lot|shipment|document|declaration)\s*(?:no\.?|id|#)?\s*[:\-]\s*([A-Z0-9][A-Z0-9\-\/]{4,})", text, flags=re.IGNORECASE)
        return match.group(1).strip() if match else None

    def _extract_issuer(self, text: str) -> str | None:
        match = re.search(r"^(?:issued by|issuer|prepared by)\s*[:\-]\s*([A-Za-z0-9&.,\s-]{3,80})", text, flags=re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else None

    def _extract_first_date(self, text: str) -> str | None:
        match = re.search(r"(20\d{2}-\d{2}-\d{2})", text)
        return match.group(1) if match else None

    def _groups(self, df: pd.DataFrame, column: str) -> Any:
        if df.empty or column not in df.columns:
            return pd.DataFrame().groupby(level=0)
        return df.groupby(column)

    def _build_commodity_name_map(self, commodity_groups: Any, commodity_lookup: dict) -> dict[int, set[str]]:
        commodity_name_map: dict[int, set[str]] = {}
        for supplier_id, rows in commodity_groups:
            commodity_names: set[str] = set()
            for _, row in rows.iterrows():
                commodity = commodity_lookup.get(int(row["commodity_id"]))
                if commodity:
                    commodity_names.add(self._clean(commodity.get("commodity_name")))
            commodity_name_map[int(supplier_id)] = commodity_names
        return commodity_name_map

    def _build_commodities(self, rows: pd.DataFrame, commodity_lookup: dict) -> list[dict]:
        commodities = []
        for _, row in rows.iterrows():
            commodity = commodity_lookup.get(int(row["commodity_id"]))
            if not commodity:
                continue
            risk_score = float(commodity["deforestation_risk_score"])
            commodities.append(
                {
                    "commodityId": int(row["commodity_id"]),
                    "name": self._clean(commodity["commodity_name"]),
                    "riskLevel": self._derive_risk_level(risk_score),
                    "deforestationRisk": risk_score,
                    "volume": float(row["volume"]),
                }
            )
        return commodities

    def _build_certifications(self, rows: pd.DataFrame, certification_lookup: dict) -> list[dict]:
        certifications = []
        for _, row in rows.iterrows():
            cert = certification_lookup.get(int(row["cert_id"]))
            if not cert:
                continue
            raw_status = self._clean(row.get("status")) or "Pending"
            expiry_date = self._clean(row.get("expiry_date"))
            certifications.append(
                {
                    "name": self._clean(cert["cert_name"]),
                    "expiryState": self._derive_expiry_state(raw_status, expiry_date),
                    "status": raw_status,
                    "expiryDate": expiry_date,
                    "evidenceId": self._optional_int(row.get("evidence_id")),
                    "validationStatus": self._clean(row.get("validation_status")),
                }
            )
        return certifications

    def _build_sites(self, rows: pd.DataFrame, site_polygon_lookup: dict[str, dict] | None = None) -> list[dict]:
        sites = []
        for _, row in rows.iterrows():
            site_id = self._clean(row.get("site_id"))
            polygon = (site_polygon_lookup or {}).get(site_id)
            sites.append(
                {
                    "siteId": site_id,
                    "supplierId": self._optional_int(row.get("supplier_id")),
                    "siteName": self._clean(row.get("site_name")),
                    "siteType": self._clean(row.get("site_type")),
                    "country": self._clean(row.get("country")),
                    "region": self._clean(row.get("region")),
                    "latitude": self._optional_float(row.get("latitude")),
                    "longitude": self._optional_float(row.get("longitude")),
                    "geoEvidenceStatus": self._clean(row.get("geo_evidence_status")) or "Missing",
                    "polygonEvidenceStatus": self._clean(row.get("polygon_evidence_status")) or "Missing",
                    "deforestationRiskStatus": self._clean(row.get("deforestation_risk_status")) or "Needs Review",
                    "lastVerifiedDate": self._clean(row.get("last_verified_date")),
                    "polygon": polygon,
                }
            )
        return sites

    def _build_lots(self, rows: pd.DataFrame, commodity_lookup: dict, lot_event_groups: Any) -> list[dict]:
        lots = []
        for _, row in rows.iterrows():
            commodity_id = int(row["commodity_id"])
            commodity = commodity_lookup.get(commodity_id, {})
            lot_id = self._clean(row.get("lot_id"))
            event_count = len(lot_event_groups.get_group(lot_id)) if lot_id in lot_event_groups.groups else 0
            lots.append(
                {
                    "lotId": lot_id,
                    "supplierId": self._optional_int(row.get("supplier_id")),
                    "commodityId": commodity_id,
                    "commodityName": self._clean(commodity.get("commodity_name")),
                    "siteId": self._clean(row.get("site_id")),
                    "lotCode": self._clean(row.get("lot_code")),
                    "quantity": self._optional_float(row.get("quantity")),
                    "unit": self._clean(row.get("unit")),
                    "productionDate": self._clean(row.get("production_date")),
                    "shipmentReference": self._clean(row.get("shipment_reference")),
                    "currentStatus": self._clean(row.get("current_status")),
                    "evidenceStatus": self._clean(row.get("evidence_status")) or "Missing",
                    "eventCount": event_count,
                }
            )
        return lots

    def _build_events(self, rows: pd.DataFrame) -> list[dict]:
        events = []
        for _, row in rows.iterrows():
            events.append(
                {
                    "eventId": self._clean(row.get("event_id")),
                    "lotId": self._clean(row.get("lot_id")),
                    "supplierId": self._optional_int(row.get("supplier_id")),
                    "eventType": self._clean(row.get("event_type")),
                    "eventDate": self._clean(row.get("event_date")),
                    "fromSiteId": self._clean(row.get("from_site_id")),
                    "toSiteId": self._clean(row.get("to_site_id")),
                    "country": self._clean(row.get("country")),
                    "evidenceType": self._clean(row.get("evidence_type")),
                    "evidenceStatus": self._clean(row.get("evidence_status")) or "Missing",
                    "notes": self._clean(row.get("notes")),
                }
            )
        return sorted(events, key=lambda item: item.get("eventDate") or "")

    def _build_gap_actions(self, rows: pd.DataFrame) -> list[dict]:
        gaps = []
        for _, row in rows.iterrows():
            gaps.append(self._gap_row_to_api(row))
        return gaps

    def _build_evidence_coverage(
        self,
        supplier: dict,
        certifications: list[dict],
        sites: list[dict],
        lots: list[dict],
        events: list[dict],
        gap_actions: list[dict],
        uploaded_evidence_rows: pd.DataFrame,
    ) -> dict:
        complete_lots = sum(1 for lot in lots if lot.get("evidenceStatus") == "Complete")
        available_events = sum(1 for event in events if event.get("evidenceStatus") == "Available")
        missing_site_geo = sum(1 for site in sites if site.get("geoEvidenceStatus") != "Available")
        missing_site_polygon = sum(
            1 for site in sites if site.get("polygonEvidenceStatus") not in {"Available", "Not Required"}
        )
        expired_or_pending_certs = sum(
            1 for cert in certifications if cert.get("expiryState") in {"Expired", "Pending", "Unknown"}
        )
        uploaded_evidence_count = 0 if uploaded_evidence_rows.empty else len(uploaded_evidence_rows)
        total_checks = 5
        passed_checks = sum(
            [
                bool(sites),
                bool(lots),
                bool(events) and available_events == len(events),
                missing_site_geo == 0 and missing_site_polygon == 0,
                expired_or_pending_certs == 0 and not self._open_gap_actions(gap_actions),
            ]
        )

        return {
            "status": self._coverage_status(passed_checks, total_checks, gap_actions),
            "coveragePercent": round((passed_checks / total_checks) * 100),
            "uploadedEvidenceCount": uploaded_evidence_count,
            "completeLotCount": complete_lots,
            "lotCount": len(lots),
            "eventCount": len(events),
            "availableEventEvidenceCount": available_events,
            "siteCount": len(sites),
            "missingGeoEvidenceCount": missing_site_geo,
            "missingPolygonEvidenceCount": missing_site_polygon,
            "certificationGapCount": expired_or_pending_certs,
            "supplierDeclaredTraceabilityRequired": supplier.get("traceabilityRequired"),
            "supplierDeclaredPlotTraceability": supplier.get("plotTraceabilityAvailable"),
            "supplierDeclaredGeolocationEvidence": supplier.get("geolocationEvidenceAvailable"),
            "supplierDeclaredChainOfCustody": supplier.get("chainOfCustodyAvailable"),
            "supplierDeclaredDeforestationDeclaration": supplier.get("deforestationDeclarationAvailable"),
        }

    def _derive_traceability_score(
        self,
        commodities: list[dict],
        certifications: list[dict],
        sites: list[dict],
        lots: list[dict],
        events: list[dict],
        gap_actions: list[dict],
        evidence_coverage: dict,
    ) -> dict:
        score = 100
        high_risk_commodities = sum(1 for commodity in commodities if commodity.get("riskLevel") == "High")
        cert_gaps = sum(1 for cert in certifications if cert.get("expiryState") in {"Expired", "Pending", "Unknown"})
        missing_events = sum(1 for event in events if event.get("evidenceStatus") != "Available")
        missing_lot_evidence = sum(1 for lot in lots if lot.get("evidenceStatus") in {"Gap", "Missing", "Partial"})
        site_gaps = evidence_coverage["missingGeoEvidenceCount"] + evidence_coverage["missingPolygonEvidenceCount"]
        open_gap_actions = self._open_gap_actions(gap_actions)
        severity_penalty = sum(self._gap_penalty(gap.get("severity")) for gap in open_gap_actions)

        score -= high_risk_commodities * 5
        score -= cert_gaps * 8
        score -= missing_events * 10
        score -= missing_lot_evidence * 6
        score -= site_gaps * 8
        score -= severity_penalty
        if not lots:
            score -= 12
        if not sites:
            score -= 10

        value = max(0, min(100, score))
        return {
            "value": value,
            "level": self._score_level(value),
            "drivers": {
                "highRiskCommodityCount": high_risk_commodities,
                "certificationGapCount": cert_gaps,
                "siteEvidenceGapCount": site_gaps,
                "lotEvidenceGapCount": missing_lot_evidence,
                "eventEvidenceGapCount": missing_events,
                "openGapActionCount": len(open_gap_actions),
            },
        }

    def _derive_eudr_readiness(
        self,
        supplier: dict,
        commodities: list[dict],
        sites: list[dict],
        events: list[dict],
        gap_actions: list[dict],
        score: dict,
    ) -> dict:
        high_risk = any(commodity.get("riskLevel") == "High" for commodity in commodities)
        eudr_relevant = supplier.get("eudrRelevant") == "Yes" or high_risk
        missing_geo = any(site.get("geoEvidenceStatus") != "Available" for site in sites)
        missing_polygon = any(site.get("polygonEvidenceStatus") not in {"Available", "Not Required"} for site in sites)
        missing_chain = not events or any(event.get("evidenceStatus") != "Available" for event in events)
        blocker_gap = any(gap.get("severity") in {"Critical", "High"} for gap in self._open_gap_actions(gap_actions))

        if not eudr_relevant:
            status = "Not Required"
        elif blocker_gap or score["value"] < 55:
            status = "Blocked"
        elif missing_geo or missing_polygon or missing_chain:
            status = "Needs Evidence"
        else:
            status = "Ready"

        return {
            "required": eudr_relevant,
            "status": status,
            "missingGeoEvidence": missing_geo,
            "missingPolygonEvidence": missing_polygon,
            "missingChainOfCustody": missing_chain,
            "openHighSeverityGap": blocker_gap,
        }

    def _build_workspace_summary(self, supplier_rows: list[dict]) -> dict:
        if not supplier_rows:
            return {
                "supplierCount": 0,
                "siteCount": 0,
                "lotCount": 0,
                "eventCount": 0,
                "openGapCount": 0,
                "averageTraceabilityScore": 0,
                "eudrReadyCount": 0,
            }

        return {
            "supplierCount": len(supplier_rows),
            "siteCount": sum(len(row["sites"]) for row in supplier_rows),
            "lotCount": sum(len(row["lots"]) for row in supplier_rows),
            "eventCount": sum(len(row["events"]) for row in supplier_rows),
            "openGapCount": sum(
                1
                for row in supplier_rows
                for gap in row["gapActions"]
                if gap.get("status") != "Closed"
            ),
            "averageTraceabilityScore": round(
                sum(row["traceabilityScore"]["value"] for row in supplier_rows) / len(supplier_rows)
            ),
            "eudrReadyCount": sum(1 for row in supplier_rows if row["eudrReadiness"]["status"] == "Ready"),
        }

    def _build_upstream_chain(
        self,
        supplier_id: int,
        supplier_lookup: dict[int, dict],
        commodity_name_map: dict[int, set[str]],
    ) -> list[dict]:
        chain: list[dict] = []
        visited: set[int] = set()
        current_id: int | None = supplier_id

        while current_id and current_id not in visited and current_id in supplier_lookup:
            visited.add(current_id)
            supplier = supplier_lookup[current_id]
            chain.append(
                {
                    "supplierId": current_id,
                    "supplierName": supplier["supplierName"],
                    "country": supplier["country"],
                    "tier": supplier["tier"],
                    "isSelected": current_id == supplier_id,
                }
            )
            current_id = self._resolve_parent_supplier_id(
                supplier_id=current_id,
                supplier_lookup=supplier_lookup,
                commodity_name_map=commodity_name_map,
            )

        return list(reversed(chain))

    def _resolve_parent_supplier_id(
        self,
        supplier_id: int,
        supplier_lookup: dict[int, dict],
        commodity_name_map: dict[int, set[str]],
    ) -> int | None:
        supplier = supplier_lookup.get(supplier_id)
        if not supplier:
            return None

        explicit_parent_id = supplier.get("parentSupplierId")
        if isinstance(explicit_parent_id, int) and explicit_parent_id in supplier_lookup:
            return explicit_parent_id

        parent_tier = self._parent_tier_for(supplier.get("tier"))
        if not parent_tier:
            return None

        supplier_commodities = commodity_name_map.get(supplier_id, set())
        if not supplier_commodities:
            return None

        best_candidate_id: int | None = None
        best_score = -1

        for candidate_id, candidate in supplier_lookup.items():
            if candidate_id == supplier_id or candidate.get("tier") != parent_tier:
                continue

            candidate_commodities = commodity_name_map.get(candidate_id, set())
            overlap_count = len(supplier_commodities.intersection(candidate_commodities))
            if overlap_count == 0:
                continue

            score = overlap_count * 10
            if candidate.get("country") == supplier.get("country"):
                score += 2

            if score > best_score or (
                score == best_score and best_candidate_id and candidate_id < best_candidate_id
            ):
                best_score = score
                best_candidate_id = candidate_id

        return best_candidate_id

    def _parent_tier_for(self, tier: str | None) -> str | None:
        if tier == "Tier 2":
            return "Tier 1"
        if tier == "Tier 3":
            return "Tier 2"
        return None

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

    def _derive_risk_level(self, deforestation_risk_score: float) -> str:
        if deforestation_risk_score >= 0.66:
            return "High"
        if deforestation_risk_score >= 0.33:
            return "Medium"
        return "Low"

    def _coverage_status(self, passed_checks: int, total_checks: int, gap_actions: list[dict]) -> str:
        if any(gap.get("severity") == "Critical" for gap in gap_actions):
            return "Critical Gap"
        if passed_checks == total_checks:
            return "Complete"
        if passed_checks >= 3:
            return "Partial"
        return "Gap"

    def _score_level(self, score: int) -> str:
        if score >= 80:
            return "Strong"
        if score >= 60:
            return "Moderate"
        if score >= 40:
            return "Weak"
        return "High Risk"

    def _gap_penalty(self, severity: str | None) -> int:
        if severity == "Critical":
            return 18
        if severity == "High":
            return 12
        if severity == "Medium":
            return 7
        return 4

    def _open_gap_actions(self, gap_actions: list[dict]) -> list[dict]:
        return [gap for gap in gap_actions if gap.get("status") != "Closed"]

    def _clean(self, value: Any) -> str:
        if value is None or pd.isna(value):
            return ""
        return str(value).strip()

    def _optional_int(self, value: Any) -> int | None:
        if value is None or pd.isna(value) or self._clean(value) == "":
            return None
        return int(float(value))

    def _optional_float(self, value: Any) -> float | None:
        if value is None or pd.isna(value) or self._clean(value) == "":
            return None
        return float(value)


traceability_service = TraceabilityService()
