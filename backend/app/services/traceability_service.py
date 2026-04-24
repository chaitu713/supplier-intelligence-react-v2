from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd


class TraceabilityService:
    def __init__(self) -> None:
        self.data_dir = Path(__file__).resolve().parents[3] / "data"

    def get_workspace_data(self) -> dict:
        suppliers_df = pd.read_csv(self.data_dir / "suppliers_v2.csv")
        supplier_commodity_map_df = pd.read_csv(self.data_dir / "supplier_commodity_map_v2.csv")
        commodities_df = pd.read_csv(self.data_dir / "commodities_v2.csv")
        supplier_certifications_df = pd.read_csv(self.data_dir / "supplier_certifications_v2.csv")
        certifications_df = pd.read_csv(self.data_dir / "certifications_v2.csv")

        suppliers_df = suppliers_df.astype(object)
        suppliers_df["parent_supplier_id"] = pd.to_numeric(
            suppliers_df.get("parent_supplier_id"), errors="coerce"
        ).apply(lambda value: None if pd.isna(value) else int(value))

        commodity_lookup = commodities_df.set_index("commodity_id").to_dict(orient="index")
        certification_lookup = certifications_df.set_index("cert_id").to_dict(orient="index")
        supplier_lookup = {
            int(row["supplier_id"]): {
                "supplierId": int(row["supplier_id"]),
                "supplierName": str(row["supplier_name"]),
                "country": str(row["country"]),
                "tier": str(row.get("tier", "")),
                "parentSupplierId": row.get("parent_supplier_id"),
            }
            for _, row in suppliers_df.iterrows()
        }

        commodity_groups = supplier_commodity_map_df.groupby("supplier_id")
        certification_groups = supplier_certifications_df.groupby("supplier_id")
        commodity_name_map: dict[int, set[str]] = {}

        for supplier_id, rows in commodity_groups:
            commodity_names: set[str] = set()
            for _, row in rows.iterrows():
                commodity = commodity_lookup.get(int(row["commodity_id"]))
                if commodity:
                    commodity_names.add(str(commodity["commodity_name"]))
            commodity_name_map[int(supplier_id)] = commodity_names

        supplier_rows: list[dict] = []
        for _, supplier in suppliers_df.iterrows():
            supplier_id = int(supplier["supplier_id"])
            if supplier_id not in commodity_groups.groups:
                continue

            commodity_rows = commodity_groups.get_group(supplier_id)
            certification_rows = (
                certification_groups.get_group(supplier_id)
                if supplier_id in certification_groups.groups
                else pd.DataFrame()
            )

            commodities = []
            for _, row in commodity_rows.iterrows():
                commodity = commodity_lookup.get(int(row["commodity_id"]))
                if not commodity:
                    continue
                commodities.append(
                    {
                        "name": commodity["commodity_name"],
                        "riskLevel": self._derive_risk_level(
                            float(commodity["deforestation_risk_score"])
                        ),
                        "deforestationRisk": float(commodity["deforestation_risk_score"]),
                        "volume": float(row["volume"]),
                    }
                )

            certifications = []
            for _, row in certification_rows.iterrows():
                cert = certification_lookup.get(int(row["cert_id"]))
                if not cert:
                    continue
                raw_status = str(row.get("status", "")).strip() or "Pending"
                expiry_date = str(row.get("expiry_date", "")).strip()
                certifications.append(
                    {
                        "name": cert["cert_name"],
                        "expiryState": self._derive_expiry_state(raw_status, expiry_date),
                    }
                )

            upstream_chain = self._build_upstream_chain(
                supplier_id=supplier_id,
                supplier_lookup=supplier_lookup,
                commodity_name_map=commodity_name_map,
            )

            supplier_rows.append(
                {
                    "supplierId": supplier_id,
                    "supplierName": supplier["supplier_name"],
                    "country": supplier["country"],
                    "tier": supplier.get("tier"),
                    "parentSupplierId": supplier.get("parent_supplier_id"),
                    "upstreamChain": upstream_chain,
                    "commodities": commodities,
                    "certifications": certifications,
                }
            )

        return {"suppliers": supplier_rows}

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

            if score > best_score or (score == best_score and best_candidate_id and candidate_id < best_candidate_id):
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


traceability_service = TraceabilityService()
