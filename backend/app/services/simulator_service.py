import pandas as pd

from ..core.exceptions import AppError
from ..schemas.simulator import SimulatorScenarioRequest
from .dataset_service import DatasetService
from .risk_service import RiskService


class SimulatorService:
    def __init__(self) -> None:
        self.risk_service = RiskService()
        self.dataset_service = DatasetService()

    def get_options(self) -> dict:
        suppliers = self.dataset_service.load_suppliers_frame()
        countries = sorted(
            {
                str(value).strip()
                for value in suppliers["country"].dropna().tolist()
                if str(value).strip()
            }
        )
        commodities = sorted(self._get_all_commodities())
        return {
            "countries": [{"label": value, "value": value} for value in countries],
            "commodities": [{"label": value, "value": value} for value in commodities],
        }

    def run_simulation(self, payload: SimulatorScenarioRequest) -> dict:
        if payload.scenarioType == "supplier_disruption":
            if payload.supplierId is None or not payload.severity:
                raise AppError("Supplier disruption requires supplierId and severity", status_code=400)
            return self.run_supplier_disruption(payload.supplierId, payload.severity)

        if payload.scenarioType == "country_disruption":
            if not payload.targetValue or not payload.severity:
                raise AppError("Country disruption requires targetValue and severity", status_code=400)
            return self.run_country_disruption(payload.targetValue, payload.severity)

        if payload.scenarioType == "commodity_shock":
            if not payload.targetValue or not payload.severity:
                raise AppError("Commodity shock requires targetValue and severity", status_code=400)
            return self.run_commodity_shock(payload.targetValue, payload.severity)

        if payload.scenarioType == "operational_deterioration":
            return self.run_operational_deterioration(payload)

        raise AppError("Unsupported simulator scenario", status_code=400)

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
        target_country = self._clean_optional_string(target.get("country"))
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
        self._increase_operational_risk(
            working,
            target_mask,
            settings["target_operational"],
        )
        self._increase_esg_risk(working, target_mask, settings["target_esg"])
        working.loc[target_mask, "simulation_reason"] = "Direct supplier disruption scenario"

        if target_country:
            country_mask = (
                working["country"].astype(str).str.lower().eq(target_country.lower()) & ~target_mask
            )
            self._increase_operational_risk(
                working,
                country_mask,
                settings["country_spillover"],
            )
            self._set_reason_if_empty(working, country_mask, "Country disruption spillover")

        if target_commodities:
            commodity_supplier_ids = self._get_suppliers_for_commodities(target_commodities)
            commodity_mask = working["supplier_id"].isin(commodity_supplier_ids) & ~target_mask
            self._increase_operational_risk(
                working,
                commodity_mask,
                settings["commodity_spillover"],
            )
            self._set_reason_if_empty(
                working,
                commodity_mask,
                "Commodity spillover from disrupted supplier",
            )

        working = self._finalize_simulation_frame(working)
        before = self._summarize(base_frame)
        after = self._summarize(working)

        return {
            "scenario": {
                "scenarioType": "supplier_disruption",
                "title": "Supplier Disruption",
                "summary": "Direct supplier shock with controlled country and commodity spillover.",
                "severity": normalized_severity,
                "supplierId": int(supplier_id),
                "supplierName": target_name,
                "country": target_country,
            },
            "before": before,
            "after": after,
            "deltas": self._build_deltas(before, after),
            "riskBandMovement": self._build_risk_band_movement(base_frame, working),
            "affectedSuppliers": self._build_affected_suppliers(base_frame, working),
        }

    def run_country_disruption(self, country: str, severity: str) -> dict:
        normalized_country = self._clean_optional_string(country)
        normalized_severity = str(severity).strip().lower()
        if not normalized_country:
            raise AppError("Country disruption requires a country", status_code=400)
        if normalized_severity not in {"moderate", "severe", "unavailable"}:
            raise AppError("Unsupported disruption severity", status_code=400)

        base_frame = self.risk_service._build_supplier_risk_frame()
        if base_frame.empty:
            raise AppError("Risk frame is unavailable", status_code=500)

        working = base_frame.copy()
        country_mask = working["country"].astype(str).str.lower().eq(normalized_country.lower())
        if not bool(country_mask.any()):
            raise AppError("Country not found for simulation", status_code=404)

        settings = {
            "moderate": {
                "target_operational": 12.0,
                "target_esg": 2.0,
                "commodity_spillover": 1.5,
            },
            "severe": {
                "target_operational": 22.0,
                "target_esg": 3.5,
                "commodity_spillover": 2.75,
            },
            "unavailable": {
                "target_operational": 34.0,
                "target_esg": 5.0,
                "commodity_spillover": 4.0,
            },
        }[normalized_severity]

        working["simulation_reason"] = ""
        self._increase_operational_risk(working, country_mask, settings["target_operational"])
        self._increase_esg_risk(working, country_mask, settings["target_esg"])
        working.loc[country_mask, "simulation_reason"] = "Direct country disruption scenario"

        impacted_supplier_ids = {
            int(value)
            for value in working.loc[country_mask, "supplier_id"].dropna().tolist()
        }
        impacted_commodities = self._get_commodities_for_suppliers(impacted_supplier_ids)
        if impacted_commodities:
            commodity_supplier_ids = self._get_suppliers_for_commodities(impacted_commodities)
            commodity_mask = working["supplier_id"].isin(commodity_supplier_ids) & ~country_mask
            self._increase_operational_risk(
                working,
                commodity_mask,
                settings["commodity_spillover"],
            )
            self._set_reason_if_empty(
                working,
                commodity_mask,
                "Commodity spillover from disrupted country",
            )

        working = self._finalize_simulation_frame(working)
        before = self._summarize(base_frame)
        after = self._summarize(working)

        return {
            "scenario": {
                "scenarioType": "country_disruption",
                "title": "Country Disruption",
                "summary": "Country-wide disruption pressure with commodity-linked spillover to related suppliers.",
                "severity": normalized_severity,
                "country": normalized_country,
                "targetValue": normalized_country,
            },
            "before": before,
            "after": after,
            "deltas": self._build_deltas(before, after),
            "riskBandMovement": self._build_risk_band_movement(base_frame, working),
            "affectedSuppliers": self._build_affected_suppliers(base_frame, working),
        }

    def run_commodity_shock(self, commodity: str, severity: str) -> dict:
        normalized_commodity = self._clean_optional_string(commodity)
        normalized_severity = str(severity).strip().lower()
        if not normalized_commodity:
            raise AppError("Commodity shock requires a commodity", status_code=400)
        if normalized_severity not in {"moderate", "severe", "unavailable"}:
            raise AppError("Unsupported disruption severity", status_code=400)

        base_frame = self.risk_service._build_supplier_risk_frame()
        if base_frame.empty:
            raise AppError("Risk frame is unavailable", status_code=500)

        impacted_supplier_ids = self._get_suppliers_for_commodities({normalized_commodity})
        if not impacted_supplier_ids:
            raise AppError("Commodity not found for simulation", status_code=404)

        working = base_frame.copy()
        settings = {
            "moderate": {
                "target_operational": 10.0,
                "target_esg": 3.0,
                "country_spillover": 1.5,
            },
            "severe": {
                "target_operational": 18.0,
                "target_esg": 5.0,
                "country_spillover": 2.75,
            },
            "unavailable": {
                "target_operational": 28.0,
                "target_esg": 7.0,
                "country_spillover": 4.0,
            },
        }[normalized_severity]

        working["simulation_reason"] = ""
        target_mask = working["supplier_id"].isin(impacted_supplier_ids)
        self._increase_operational_risk(working, target_mask, settings["target_operational"])
        self._increase_esg_risk(working, target_mask, settings["target_esg"])
        working.loc[target_mask, "simulation_reason"] = "Direct commodity shock scenario"

        impacted_countries = {
            country
            for country in working.loc[target_mask, "country"].dropna().astype(str).tolist()
            if country.strip()
        }
        if impacted_countries:
            country_mask = (
                working["country"].astype(str).isin(list(impacted_countries)) & ~target_mask
            )
            self._increase_operational_risk(working, country_mask, settings["country_spillover"])
            self._set_reason_if_empty(
                working,
                country_mask,
                "Country spillover from commodity shock",
            )

        working = self._finalize_simulation_frame(working)
        before = self._summarize(base_frame)
        after = self._summarize(working)

        return {
            "scenario": {
                "scenarioType": "commodity_shock",
                "title": "Commodity Shock",
                "summary": "Commodity-specific disruption pressure with related country spillover across the affected supply base.",
                "severity": normalized_severity,
                "targetValue": normalized_commodity,
            },
            "before": before,
            "after": after,
            "deltas": self._build_deltas(before, after),
            "riskBandMovement": self._build_risk_band_movement(base_frame, working),
            "affectedSuppliers": self._build_affected_suppliers(base_frame, working),
        }

    def run_operational_deterioration(self, payload: SimulatorScenarioRequest) -> dict:
        target_type = (payload.targetType or "").strip().lower()
        target_value = self._clean_optional_string(payload.targetValue)
        delay = float(payload.delayIncreasePct or 0.0)
        defect = float(payload.defectIncreasePct or 0.0)
        cost = float(payload.costVarianceIncreasePct or 0.0)

        if target_type not in {"supplier", "country", "commodity"}:
            raise AppError("Operational deterioration requires a valid targetType", status_code=400)
        if not target_value:
            raise AppError("Operational deterioration requires a targetValue", status_code=400)
        if delay <= 0 and defect <= 0 and cost <= 0:
            raise AppError(
                "Operational deterioration requires at least one non-zero deterioration input",
                status_code=400,
            )

        base_frame = self.risk_service._build_supplier_risk_frame()
        if base_frame.empty:
            raise AppError("Risk frame is unavailable", status_code=500)
        working = base_frame.copy()
        working["simulation_reason"] = ""

        direct_increase = min(42.0, round(delay * 0.18 + defect * 0.22 + cost * 0.16, 2))
        secondary_increase = round(min(12.0, direct_increase * 0.28), 2)
        esg_uplift = round(min(6.0, direct_increase * 0.08), 2)

        target_label = target_value
        if target_type == "supplier":
            try:
                supplier_id = int(target_value)
            except ValueError as exc:
                raise AppError("Supplier targetValue must be a supplier id", status_code=400) from exc
            target_rows = working[working["supplier_id"] == supplier_id]
            if target_rows.empty:
                raise AppError("Supplier not found for simulation", status_code=404)
            target = target_rows.iloc[0]
            target_mask = working["supplier_id"] == supplier_id
            self._increase_operational_risk(working, target_mask, direct_increase)
            self._increase_esg_risk(working, target_mask, esg_uplift)
            working.loc[target_mask, "simulation_reason"] = "Direct operational deterioration scenario"
            target_name = str(target.get("supplier_name") or "Unknown Supplier")
            target_label = target_name
            target_country = self._clean_optional_string(target.get("country"))
            if target_country:
                country_mask = (
                    working["country"].astype(str).str.lower().eq(target_country.lower()) & ~target_mask
                )
                self._increase_operational_risk(working, country_mask, secondary_increase)
                self._set_reason_if_empty(
                    working,
                    country_mask,
                    "Country spillover from deteriorating supplier",
                )

            target_commodities = self._get_supplier_commodities(supplier_id)
            if target_commodities:
                commodity_supplier_ids = self._get_suppliers_for_commodities(target_commodities)
                commodity_mask = working["supplier_id"].isin(commodity_supplier_ids) & ~target_mask
                self._increase_operational_risk(
                    working,
                    commodity_mask,
                    round(secondary_increase * 0.8, 2),
                )
                self._set_reason_if_empty(
                    working,
                    commodity_mask,
                    "Commodity spillover from deteriorating supplier",
                )

        elif target_type == "country":
            target_mask = working["country"].astype(str).str.lower().eq(target_value.lower())
            if not bool(target_mask.any()):
                raise AppError("Country not found for simulation", status_code=404)
            self._increase_operational_risk(working, target_mask, direct_increase)
            self._increase_esg_risk(working, target_mask, esg_uplift)
            working.loc[target_mask, "simulation_reason"] = "Country-level operational deterioration"

        else:
            commodity_supplier_ids = self._get_suppliers_for_commodities({target_value})
            if not commodity_supplier_ids:
                raise AppError("Commodity not found for simulation", status_code=404)
            target_mask = working["supplier_id"].isin(commodity_supplier_ids)
            self._increase_operational_risk(working, target_mask, direct_increase)
            self._increase_esg_risk(working, target_mask, round(esg_uplift * 0.7, 2))
            working.loc[target_mask, "simulation_reason"] = "Commodity-linked operational deterioration"

        working = self._finalize_simulation_frame(working)
        before = self._summarize(base_frame)
        after = self._summarize(working)

        summary = (
            f"Operational deterioration applied to {target_type} target with "
            f"delay +{delay:.0f}%, defect +{defect:.0f}%, and cost variance +{cost:.0f}%."
        )

        return {
            "scenario": {
                "scenarioType": "operational_deterioration",
                "title": "Operational Deterioration",
                "summary": summary,
                "targetType": target_type,
                "targetValue": target_label,
                "delayIncreasePct": round(delay, 2),
                "defectIncreasePct": round(defect, 2),
                "costVarianceIncreasePct": round(cost, 2),
            },
            "before": before,
            "after": after,
            "deltas": self._build_deltas(before, after),
            "riskBandMovement": self._build_risk_band_movement(base_frame, working),
            "affectedSuppliers": self._build_affected_suppliers(base_frame, working),
        }

    def _finalize_simulation_frame(self, frame: pd.DataFrame) -> pd.DataFrame:
        working = frame.copy()
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
        return working

    def _increase_operational_risk(self, frame: pd.DataFrame, mask: pd.Series, value: float) -> None:
        frame.loc[mask, "operational_risk_score"] = (
            pd.to_numeric(frame.loc[mask, "operational_risk_score"], errors="coerce")
            .fillna(0.0)
            .add(value)
            .clip(0, 100)
        )

    def _increase_esg_risk(self, frame: pd.DataFrame, mask: pd.Series, value: float) -> None:
        frame.loc[mask, "esg_risk_score"] = (
            pd.to_numeric(frame.loc[mask, "esg_risk_score"], errors="coerce")
            .fillna(0.0)
            .add(value)
            .clip(0, 100)
        )

    def _set_reason_if_empty(self, frame: pd.DataFrame, mask: pd.Series, reason: str) -> None:
        frame.loc[mask, "simulation_reason"] = frame.loc[mask, "simulation_reason"].where(
            frame.loc[mask, "simulation_reason"].ne(""),
            reason,
        )

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

    def _build_deltas(self, before: dict, after: dict) -> dict:
        return {
            key: round(float(after[key]) - float(before[key]), 2)
            for key in before
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
                "country": self._clean_optional_string(row.get("country")),
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
        return {value.strip() for value in values if value.strip()}

    def _get_commodities_for_suppliers(self, supplier_ids: set[int]) -> set[str]:
        if not supplier_ids:
            return set()
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

        values = (
            frame.loc[frame["supplier_id"].isin(list(supplier_ids)), column]
            .dropna()
            .astype(str)
            .tolist()
        )
        return {value.strip() for value in values if value.strip()}

    def _get_all_commodities(self) -> set[str]:
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
            values = frame["commodity_name"].dropna().astype(str).tolist()
        else:
            values = frame["commodity_id"].dropna().astype(str).tolist()

        return {value.strip() for value in values if value.strip()}

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

    def _clean_optional_string(self, value: object) -> str | None:
        if value is None or pd.isna(value):
            return None
        text = str(value).strip()
        return text or None
