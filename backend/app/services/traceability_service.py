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

        commodity_lookup = commodities_df.set_index("commodity_id").to_dict(orient="index")
        certification_lookup = certifications_df.set_index("cert_id").to_dict(orient="index")

        commodity_groups = supplier_commodity_map_df.groupby("supplier_id")
        certification_groups = supplier_certifications_df.groupby("supplier_id")

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

            supplier_rows.append(
                {
                    "supplierId": supplier_id,
                    "supplierName": supplier["supplier_name"],
                    "country": supplier["country"],
                    "commodities": commodities,
                    "certifications": certifications,
                }
            )

        return {"suppliers": supplier_rows}

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
