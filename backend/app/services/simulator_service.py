import pandas as pd

from ..core.exceptions import AppError
from .dataset_service import DatasetService
from .risk_service import RiskService


class SimulatorService:
    def __init__(self) -> None:
        self.risk_service = RiskService()
        self.dataset_service = DatasetService()

    def run_supplier_disruption(self, supplier_id: int, severity: str) -> dict:
        normalized_severity = str(severity).strip().lower()
        if normalized_severity not in {"moderate", "severe", "unavailable"}:
            raise AppError("Unsupported disruption severity", status_code=400)

        base_frame = self.risk_service._build_supplier_risk_frame()
        if base_frame.empty:
            raise AppError("Risk frame is unavailable", status_code=500)

        working = base_frame.copy()
        target_rows = working[working["supplier_id"] == supplier_id]
        if target_rows.empty:
            raise AppError("Supplier not found for simulation", status_code=404)

        target = target_rows.iloc[0]
        target_country = target.get("country")
        target_name = str(target.get("supplier_name") or "Unknown Supplier")
        target_commodities = self._get_supplier_commodities(supplier_id)

        settings = {
            "moderate": {
                "target_operational": 14.0,
                "target_esg": 2.5,
                "country_spillover": 2.0,
                "commodity_spillover": 1.5,
            },
            "severe": {
                "target_operational": 26.0,
                "target_esg": 4.5,
                "country_spillover": 4.0,
                "commodity_spillover": 3.0,
            },
            "unavailable": {
                "target_operational": 40.0,
                "target_esg": 6.0,
                "country_spillover": 6.0,
                "commodity_spillover": 4.5,
            },
        }[normalized_severity]

        working["simulation_reason"] = ""
        target_mask = working["supplier_id"] == supplier_id
        working.loc[target_mask, "operational_risk_score"] = (
            pd.to_numeric(working.loc[target_mask, "operational_risk_score"], errors="coerce")
            .fillna(0.0)
            .add(settings["target_operational"])
            .clip(0, 100)
        )
        working.loc[target_mask, "esg_risk_score"] = (
            pd.to_numeric(working.loc[target_mask, "esg_risk_score"], errors="coerce")
            .fillna(0.0)
            .add(settings["target_esg"])
            .clip(0, 100)
        )
        working.loc[target_mask, "simulation_reason"] = "Direct supplier disruption scenario"

        if target_country:
            country_mask = (
                working["country"].astype(str).str.lower().eq(str(target_country).lower()) & ~target_mask
            )
            working.loc[country_mask, "operational_risk_score"] = (
                pd.to_numeric(working.loc[country_mask, "operational_risk_score"], errors="coerce")
                .fillna(0.0)
                .add(settings["country_spillover"])
                .clip(0, 100)
            )
            working.loc[country_mask, "simulation_reason"] = working.loc[country_mask, "simulation_reason"].where(
                working.loc[country_mask, "simulation_reason"].ne(""),
                "Country disruption spillover",
            )

        if target_commodities:
            commodity_supplier_ids = self._get_suppliers_for_commodities(target_commodities)
            commodity_mask = working["supplier_id"].isin(commodity_supplier_ids) & ~target_mask
            working.loc[commodity_mask, "operational_risk_score"] = (
                pd.to_numeric(working.loc[commodity_mask, "operational_risk_score"], errors="coerce")
                .fillna(0.0)
                .add(settings["commodity_spillover"])
                .clip(0, 100)
            )
            reason_mask = commodity_mask & working["simulation_reason"].eq("")
            working.loc[reason_mask, "simulation_reason"] = "Commodity spillover from disrupted supplier"

        working["overall_risk_score"] = self._recompute_overall_risk(working)
        working["overall_risk_level"] = working["overall_risk_score"].apply(
            self.risk_service._classify_risk_level
        )
        working["operational_risk_level"] = working["operational_risk_score"].apply(
            self.risk_service._classify_risk_level
        )
        working["esg_risk_level"] = working["esg_risk_score"].apply(
            self.risk_service._classify_risk_level
        )

        before = self._summarize(base_frame)
        after = self._summarize(working)
        affected_suppliers = self._build_affected_suppliers(base_frame, working)

        return {
            "scenario": {
                "scenarioType": "supplier_disruption",
                "severity": normalized_severity,
                "supplierId": int(supplier_id),
                "supplierName": target_name,
                "country": target_country,
            },
            "before": before,
            "after": after,
            "deltas": {
                key: round(float(after[key]) - float(before[key]), 2)
                for key in before
            },
            "riskBandMovement": self._build_risk_band_movement(base_frame, working),
            "affectedSuppliers": affected_suppliers,
        }

    def _recompute_overall_risk(self, frame: pd.DataFrame) -> pd.Series:
        dual_pressure = (
            ((frame["operational_risk_score"] + frame["esg_risk_score"]) / 2) * 0.05
        ).round(2)
        imbalance_pressure = (
            ((frame["operational_risk_score"] - frame["esg_risk_score"]).abs() / 100)
            * frame[["operational_risk_score", "esg_risk_score"]].max(axis=1)
            * 0.30
        ).round(2)
        return (
            0.58 * frame["operational_risk_score"]
            + 0.37 * frame["esg_risk_score"]
            + dual_pressure
            + imbalance_pressure
        ).clip(0, 100).round(2)

    def _summarize(self, frame: pd.DataFrame) -> dict:
        counts = frame["overall_risk_level"].value_counts()
        return {
            "highRiskSuppliers": int(counts.get("High", 0)),
            "mediumRiskSuppliers": int(counts.get("Medium", 0)),
            "lowRiskSuppliers": int(counts.get("Low", 0)),
            "avgOverallRisk": round(float(frame["overall_risk_score"].mean()), 2),
            "avgOperationalRisk": round(float(frame["operational_risk_score"].mean()), 2),
            "avgEsgRisk": round(float(frame["esg_risk_score"].mean()), 2),
        }

    def _build_risk_band_movement(
        self,
        before_frame: pd.DataFrame,
        after_frame: pd.DataFrame,
    ) -> list[dict]:
        joined = before_frame[
            ["supplier_id", "overall_risk_level"]
        ].merge(
            after_frame[["supplier_id", "overall_risk_level"]],
            on="supplier_id",
            suffixes=("_before", "_after"),
        )
        grouped = (
            joined.groupby(["overall_risk_level_before", "overall_risk_level_after"])
            .size()
            .reset_index(name="supplierCount")
            .sort_values("supplierCount", ascending=False)
        )
        return [
            {
                "fromBand": str(row["overall_risk_level_before"]),
                "toBand": str(row["overall_risk_level_after"]),
                "supplierCount": int(row["supplierCount"]),
            }
            for _, row in grouped.iterrows()
            if int(row["supplierCount"]) > 0
        ]

    def _build_affected_suppliers(
        self,
        before_frame: pd.DataFrame,
        after_frame: pd.DataFrame,
        limit: int = 8,
    ) -> list[dict]:
        joined = before_frame[
            ["supplier_id", "supplier_name", "country", "overall_risk_score", "overall_risk_level"]
        ].merge(
            after_frame[
                [
                    "supplier_id",
                    "overall_risk_score",
                    "overall_risk_level",
                    "simulation_reason",
                ]
            ],
            on="supplier_id",
            suffixes=("_before", "_after"),
        )
        joined["delta_overall_risk"] = (
            pd.to_numeric(joined["overall_risk_score_after"], errors="coerce").fillna(0.0)
            - pd.to_numeric(joined["overall_risk_score_before"], errors="coerce").fillna(0.0)
        ).round(2)
        affected = joined[joined["delta_overall_risk"] > 0].sort_values(
            ["delta_overall_risk", "overall_risk_score_after"],
            ascending=[False, False],
        ).head(limit)

        return [
            {
                "supplierId": int(row["supplier_id"]),
                "supplierName": str(row.get("supplier_name") or "Unknown Supplier"),
                "country": row.get("country"),
                "beforeOverallRisk": round(float(row["overall_risk_score_before"]), 2),
                "afterOverallRisk": round(float(row["overall_risk_score_after"]), 2),
                "deltaOverallRisk": round(float(row["delta_overall_risk"]), 2),
                "beforeRiskLevel": str(row["overall_risk_level_before"]),
                "afterRiskLevel": str(row["overall_risk_level_after"]),
                "impactReason": str(row.get("simulation_reason") or "Scenario impact"),
            }
            for _, row in affected.iterrows()
        ]

    def _get_supplier_commodities(self, supplier_id: int) -> set[str]:
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )
        if supplier_commodity_map.empty:
            return set()

        frame = supplier_commodity_map.copy()
        if not commodities.empty and {"commodity_id", "commodity_name"}.issubset(commodities.columns):
            frame = frame.merge(
                commodities[["commodity_id", "commodity_name"]],
                on="commodity_id",
                how="left",
            )
            column = "commodity_name"
        else:
            column = "commodity_id"

        values = frame.loc[frame["supplier_id"] == supplier_id, column].dropna().astype(str).tolist()
        return set(values)

    def _get_suppliers_for_commodities(self, commodities: set[str]) -> set[int]:
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities_frame = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )
        if supplier_commodity_map.empty:
            return set()

        frame = supplier_commodity_map.copy()
        if not commodities_frame.empty and {"commodity_id", "commodity_name"}.issubset(commodities_frame.columns):
            frame = frame.merge(
                commodities_frame[["commodity_id", "commodity_name"]],
                on="commodity_id",
                how="left",
            )
            mask = frame["commodity_name"].astype(str).isin(list(commodities))
        else:
            mask = frame["commodity_id"].astype(str).isin(list(commodities))

        return {int(value) for value in frame.loc[mask, "supplier_id"].dropna().tolist()}
