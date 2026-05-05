from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd


class TraceabilityService:
    def __init__(self) -> None:
        self.data_dir = Path(__file__).resolve().parents[3] / "data"

    def get_workspace_data(self) -> dict:
        suppliers_df = self._read_csv("suppliers_v2.csv")
        supplier_commodity_map_df = self._read_csv("supplier_commodity_map_v2.csv")
        commodities_df = self._read_csv("commodities_v2.csv")
        supplier_certifications_df = self._read_csv("supplier_certifications_v2.csv")
        certifications_df = self._read_csv("certifications_v2.csv")
        evidence_df = self._read_csv("supplier_evidence_v2.csv")
        sites_df = self._read_csv("supplier_sites_v2.csv")
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
                site_groups.get_group(supplier_id) if supplier_id in site_groups.groups else pd.DataFrame()
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
                    "gapActions": gap_actions,
                    "traceabilityScore": traceability_score,
                    "eudrReadiness": eudr_readiness,
                }
            )

        return {
            "suppliers": supplier_rows,
            "workspaceSummary": self._build_workspace_summary(supplier_rows),
        }

    def _read_csv(self, filename: str) -> pd.DataFrame:
        path = self.data_dir / filename
        if not path.exists():
            return pd.DataFrame()
        return pd.read_csv(path)

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

    def _build_sites(self, rows: pd.DataFrame) -> list[dict]:
        sites = []
        for _, row in rows.iterrows():
            sites.append(
                {
                    "siteId": self._clean(row.get("site_id")),
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
            gaps.append(
                {
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
            )
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
                expired_or_pending_certs == 0 and not gap_actions,
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
        severity_penalty = sum(self._gap_penalty(gap.get("severity")) for gap in gap_actions)

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
                "openGapActionCount": len(gap_actions),
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
        blocker_gap = any(gap.get("severity") in {"Critical", "High"} and gap.get("status") != "Closed" for gap in gap_actions)

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
