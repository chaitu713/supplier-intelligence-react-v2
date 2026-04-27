import pandas as pd

from ..core.exceptions import AppError
from ..core.logging import get_logger
from .dataset_service import DatasetService
from .risk_service import RiskService

logger = get_logger(__name__)


class AnalyticsService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()
        self.risk_service = RiskService()

    def get_overview_metrics(self) -> dict:
        suppliers = pd.DataFrame(self.dataset_service.get_suppliers())
        esg = pd.DataFrame(self.dataset_service.get_esg())
        transactions = self._load_full_transactions()
        performance = pd.DataFrame(self.dataset_service.get_supplier_performance())

        metrics = {
            "totalSuppliers": int(len(suppliers)),
            "avgEsgScore": round(float(esg["esg_score"].mean()), 1) if not esg.empty else 0.0,
            "avgDelayDays": round(float(transactions["delivery_delay_days"].mean()), 1)
            if not transactions.empty
            else 0.0,
            "avgDefectRatePct": round(float(transactions["defect_rate"].mean()) * 100, 2)
            if not transactions.empty
            else 0.0,
            "highRiskCount": int((performance["risk_score"] > 8).sum()) if not performance.empty else 0,
        }

        logger.info("Computed overview metrics")
        return metrics

    def get_executive_dashboard(self) -> dict:
        suppliers = self.dataset_service.load_suppliers_frame()
        supplier_certs = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_certifications_file,
            "supplier_certifications",
        )
        risk_frame = self.risk_service._build_supplier_risk_frame()

        expiring_or_expired_certifications = 0
        certification_health = {
            "valid": 0,
            "expiringSoon": 0,
            "expired": 0,
        }
        if not supplier_certs.empty:
            expiry_dates = pd.to_datetime(supplier_certs.get("expiry_date"), errors="coerce")
            expiring_or_expired_certifications = int(
                expiry_dates.le(pd.Timestamp("2026-06-26")).fillna(False).sum()
            )
            certification_health = {
                "valid": int(expiry_dates.gt(pd.Timestamp("2026-06-26")).fillna(False).sum()),
                "expiringSoon": int(
                    expiry_dates.gt(pd.Timestamp("2026-04-27"))
                    .fillna(False)
                    .mul(expiry_dates.le(pd.Timestamp("2026-06-26")).fillna(False))
                    .sum()
                ),
                "expired": int(expiry_dates.le(pd.Timestamp("2026-04-27")).fillna(False).sum()),
            }

        if risk_frame.empty:
            risk_overview = {
                "highRiskCount": 0,
                "avgOverallRisk": 0.0,
                "avgOperationalRisk": 0.0,
                "avgEsgRisk": 0.0,
            }
            top_suppliers: list[dict] = []
            geographic_exposure: list[dict] = []
            commodity_exposure: list[dict] = []
            risk_mix = {"high": 0, "medium": 0, "low": 0}
            operational_risk_mix = {"high": 0, "medium": 0, "low": 0}
            esg_risk_mix = {"high": 0, "medium": 0, "low": 0}
        else:
            risk_overview = self.risk_service.get_risk_overview()
            top_suppliers = self.risk_service.get_top_risk_suppliers(limit=5)
            geographic_exposure = self._build_geographic_exposure(risk_frame, limit=None)
            commodity_exposure = self._build_commodity_exposure()
            level_counts = risk_frame["overall_risk_level"].value_counts()
            operational_counts = risk_frame["operational_risk_level"].value_counts()
            esg_counts = risk_frame["esg_risk_level"].value_counts()
            risk_mix = {
                "high": int(level_counts.get("High", 0)),
                "medium": int(level_counts.get("Medium", 0)),
                "low": int(level_counts.get("Low", 0)),
            }
            operational_risk_mix = {
                "high": int(operational_counts.get("High", 0)),
                "medium": int(operational_counts.get("Medium", 0)),
                "low": int(operational_counts.get("Low", 0)),
            }
            esg_risk_mix = {
                "high": int(esg_counts.get("High", 0)),
                "medium": int(esg_counts.get("Medium", 0)),
                "low": int(esg_counts.get("Low", 0)),
            }

        kpis = {
            "totalSuppliers": int(len(suppliers)),
            "highRiskSuppliers": int(risk_overview["highRiskCount"]),
            "avgOverallRisk": round(float(risk_overview["avgOverallRisk"]), 2),
            "avgOperationalRisk": round(float(risk_overview["avgOperationalRisk"]), 2),
            "avgEsgRisk": round(float(risk_overview["avgEsgRisk"]), 2),
            "expiringOrExpiredCertifications": expiring_or_expired_certifications,
        }

        suppliers_needing_review = len(
            [supplier for supplier in top_suppliers if supplier["riskLevel"] == "High"]
        )
        health = {
            "networkHealth": self._health_band(kpis["avgOverallRisk"], reverse=False),
            "operationalStability": self._health_band(
                float(risk_overview.get("avgOperationalRisk", 0.0)),
                reverse=False,
            ),
            "esgCompliance": self._health_band(
                max(
                    float(risk_overview.get("avgEsgRisk", 0.0)),
                    expiring_or_expired_certifications * 2.5,
                ),
                reverse=False,
            ),
            "suppliersNeedingReview": suppliers_needing_review,
        }
        attention = {
            "geographicExposure": geographic_exposure,
            "commodityExposure": commodity_exposure,
            "suppliersRequiringReview": [
                {
                    "supplierId": supplier["supplierId"],
                    "supplierName": supplier["supplierName"],
                    "riskLevel": supplier["riskLevel"],
                    "overallRiskScore": supplier["overallRiskScore"],
                    "reason": self._build_supplier_reason(supplier),
                }
                for supplier in top_suppliers
            ],
        }

        return {
            "reportingDate": "2026-04-27",
            "kpis": kpis,
            "health": health,
            "riskMix": risk_mix,
            "operationalRiskMix": operational_risk_mix,
            "esgRiskMix": esg_risk_mix,
            "certificationHealth": certification_health,
            "attention": attention,
        }

    def get_country_distribution(self) -> list[dict]:
        suppliers = pd.DataFrame(self.dataset_service.get_suppliers())
        if suppliers.empty or "country" not in suppliers.columns:
            return []

        country_counts = (
            suppliers["country"]
            .fillna("Unknown")
            .astype(str)
            .value_counts()
            .head(7)
            .reset_index()
        )
        country_counts.columns = ["country", "supplierCount"]

        return country_counts.to_dict(orient="records")

    def get_country_analysis(
        self,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> dict:
        risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        if risk_frame.empty or "country" not in risk_frame.columns:
            return {"countries": []}

        grouped = (
            risk_frame.groupby("country")
            .agg(
                supplierCount=("supplier_id", "count"),
                avgOverallRisk=("overall_risk_score", "mean"),
                avgOperationalRisk=("operational_risk_score", "mean"),
                avgEsgRisk=("esg_risk_score", "mean"),
            )
            .reset_index()
        )

        supplier_certs = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_certifications_file,
            "supplier_certifications",
        )
        certification_counts = pd.DataFrame(
            columns=["country", "expiringCertifications", "expiredCertifications"]
        )
        if not supplier_certs.empty:
            suppliers = self.dataset_service.load_suppliers_frame()[["supplier_id", "country"]]
            certs = supplier_certs.merge(suppliers, on="supplier_id", how="left")
            certs["expiry_date"] = pd.to_datetime(certs.get("expiry_date"), errors="coerce")
            certs["expiringCertifications"] = certs["expiry_date"].between(
                pd.Timestamp("2026-04-28"),
                pd.Timestamp("2026-06-26"),
                inclusive="both",
            ).astype(int)
            certs["expiredCertifications"] = certs["expiry_date"].lt(pd.Timestamp("2026-04-28")).astype(int)
            certification_counts = (
                certs.groupby("country")
                .agg(
                    expiringCertifications=("expiringCertifications", "sum"),
                    expiredCertifications=("expiredCertifications", "sum"),
                )
                .reset_index()
            )

        merged = grouped.merge(certification_counts, on="country", how="left").fillna(0)
        merged = merged.sort_values(["supplierCount", "avgOverallRisk"], ascending=[False, False])

        return {
            "countries": [
                {
                    "country": str(row["country"]) if row["country"] else "Unknown",
                    "supplierCount": int(row["supplierCount"]),
                    "avgOverallRisk": round(float(row["avgOverallRisk"]), 2),
                    "avgOperationalRisk": round(float(row["avgOperationalRisk"]), 2),
                    "avgEsgRisk": round(float(row["avgEsgRisk"]), 2),
                    "expiringCertifications": int(row["expiringCertifications"]),
                    "expiredCertifications": int(row["expiredCertifications"]),
                }
                for _, row in merged.iterrows()
            ]
        }

    def get_commodity_analysis(
        self,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> dict:
        risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )

        if risk_frame.empty or supplier_commodity_map.empty:
            return {"commodities": []}

        frame = supplier_commodity_map.copy()
        if not commodities.empty and "commodity_id" in frame.columns and "commodity_id" in commodities.columns:
            merge_columns = ["commodity_id"]
            available_columns = [
                column
                for column in ["commodity_name", "deforestation_risk_score"]
                if column in commodities.columns
            ]
            frame = frame.merge(
                commodities[merge_columns + available_columns],
                on="commodity_id",
                how="left",
            )

        frame = frame.merge(
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
        frame["volume"] = pd.to_numeric(frame.get("volume"), errors="coerce")

        commodity_col = "commodity_name" if "commodity_name" in frame.columns else "commodity_id"
        grouped = (
            frame.groupby(commodity_col)
            .agg(
                supplierCount=("supplier_id", "nunique"),
                avgOverallRisk=("overall_risk_score", "mean"),
                avgOperationalRisk=("operational_risk_score", "mean"),
                avgEsgRisk=("esg_risk_score", "mean"),
                deforestationRiskScore=("deforestation_risk_score", "mean"),
                avgVolume=("volume", "mean"),
            )
            .reset_index()
            .rename(columns={commodity_col: "commodity"})
            .sort_values(["supplierCount", "avgOverallRisk"], ascending=[False, False])
        )

        return {
            "commodities": [
                {
                    "commodity": str(row["commodity"]) if pd.notna(row["commodity"]) else "Unknown",
                    "supplierCount": int(row["supplierCount"]),
                    "avgOverallRisk": round(float(row["avgOverallRisk"]), 2)
                    if pd.notna(row["avgOverallRisk"])
                    else 0.0,
                    "avgOperationalRisk": round(float(row["avgOperationalRisk"]), 2)
                    if pd.notna(row["avgOperationalRisk"])
                    else 0.0,
                    "avgEsgRisk": round(float(row["avgEsgRisk"]), 2)
                    if pd.notna(row["avgEsgRisk"])
                    else 0.0,
                    "deforestationRiskScore": round(float(row["deforestationRiskScore"]), 3)
                    if pd.notna(row["deforestationRiskScore"])
                    else 0.0,
                    "avgVolume": round(float(row["avgVolume"]), 2)
                    if pd.notna(row["avgVolume"])
                    else 0.0,
                }
                for _, row in grouped.iterrows()
            ]
        }

    def get_supplier_rankings(
        self,
        limit: int = 8,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> dict:
        risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        if risk_frame.empty:
            return {
                "topOverallRisk": [],
                "topOperationalRisk": [],
                "topEsgRisk": [],
                "lowestRisk": [],
            }

        def serialize(frame: pd.DataFrame) -> list[dict]:
            return [
                {
                    "supplierId": int(row["supplier_id"]),
                    "supplierName": str(row.get("supplier_name") or "Unknown Supplier"),
                    "country": row.get("country"),
                    "tier": row.get("tier"),
                    "overallRiskScore": round(float(row["overall_risk_score"]), 2),
                    "operationalRiskScore": round(float(row["operational_risk_score"]), 2),
                    "esgRiskScore": round(float(row["esg_risk_score"]), 2),
                    "riskLevel": row.get("overall_risk_level") or "Unknown",
                    "primaryDriver": self._build_primary_driver(row),
                }
                for _, row in frame.iterrows()
            ]

        return {
            "topOverallRisk": serialize(
                risk_frame.sort_values("overall_risk_score", ascending=False).head(limit)
            ),
            "topOperationalRisk": serialize(
                risk_frame.sort_values("operational_risk_score", ascending=False).head(limit)
            ),
            "topEsgRisk": serialize(
                risk_frame.sort_values("esg_risk_score", ascending=False).head(limit)
            ),
            "lowestRisk": serialize(
                risk_frame.sort_values("overall_risk_score", ascending=True).head(limit)
            ),
        }

    def get_certification_analysis(
        self,
        limit: int = 8,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> dict:
        supplier_certs = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_certifications_file,
            "supplier_certifications",
        )
        filtered_risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        suppliers = filtered_risk_frame[["supplier_id", "supplier_name", "country"]].copy()
        if supplier_certs.empty or suppliers.empty:
            return {
                "byCountry": [],
                "topSuppliers": [],
            }

        certs = supplier_certs.copy()
        certs["expiry_date"] = pd.to_datetime(certs.get("expiry_date"), errors="coerce")
        certs["valid"] = certs["expiry_date"].gt(pd.Timestamp("2026-06-26")).fillna(False).astype(int)
        certs["expiringSoon"] = certs["expiry_date"].between(
            pd.Timestamp("2026-04-28"),
            pd.Timestamp("2026-06-26"),
            inclusive="both",
        ).fillna(False).astype(int)
        certs["expired"] = certs["expiry_date"].lt(pd.Timestamp("2026-04-28")).fillna(False).astype(int)

        certs = certs.merge(
            suppliers[["supplier_id", "supplier_name", "country"]],
            on="supplier_id",
            how="left",
        )

        by_country = (
            certs.groupby("country")
            .agg(
                valid=("valid", "sum"),
                expiringSoon=("expiringSoon", "sum"),
                expired=("expired", "sum"),
            )
            .reset_index()
            .sort_values(["expired", "expiringSoon", "valid"], ascending=[False, False, False])
        )

        by_supplier = (
            certs.groupby(["supplier_id", "supplier_name", "country"])
            .agg(
                valid=("valid", "sum"),
                expiringSoon=("expiringSoon", "sum"),
                expired=("expired", "sum"),
            )
            .reset_index()
        )
        by_supplier["pressure"] = by_supplier["expired"] * 2 + by_supplier["expiringSoon"]
        by_supplier = by_supplier.sort_values(
            ["pressure", "expired", "expiringSoon"],
            ascending=[False, False, False],
        ).head(limit)

        return {
            "byCountry": [
                {
                    "country": str(row["country"]) if row["country"] else "Unknown",
                    "valid": int(row["valid"]),
                    "expiringSoon": int(row["expiringSoon"]),
                    "expired": int(row["expired"]),
                }
                for _, row in by_country.iterrows()
            ],
            "topSuppliers": [
                {
                    "supplierId": int(row["supplier_id"]),
                    "supplierName": str(row["supplier_name"]) if row["supplier_name"] else "Unknown Supplier",
                    "country": row.get("country"),
                    "valid": int(row["valid"]),
                    "expiringSoon": int(row["expiringSoon"]),
                    "expired": int(row["expired"]),
                }
                for _, row in by_supplier.iterrows()
            ],
        }

    def get_risk_distributions(
        self,
        bins: int = 20,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> dict:
        risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        if risk_frame.empty:
            return {
                "overall": [],
                "operational": [],
                "esg": [],
            }

        return {
            "overall": self._build_histogram(
                risk_frame.get("overall_risk_score", pd.Series(dtype=float)),
                max(1, bins),
            ),
            "operational": self._build_histogram(
                risk_frame.get("operational_risk_score", pd.Series(dtype=float)),
                max(1, bins),
            ),
            "esg": self._build_histogram(
                risk_frame.get("esg_risk_score", pd.Series(dtype=float)),
                max(1, bins),
            ),
        }

    def get_esg_pillar_analysis(
        self,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
        limit: int = 8,
    ) -> dict:
        risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        if risk_frame.empty:
            return {
                "byCountry": [],
                "topSuppliers": [],
            }

        by_country = (
            risk_frame.groupby("country")
            .agg(
                environmental=("environmental_risk_score", "mean"),
                social=("social_risk_score", "mean"),
                governance=("governance_risk_score", "mean"),
            )
            .reset_index()
            .sort_values("environmental", ascending=False)
        )

        top_suppliers = risk_frame.sort_values(
            ["environmental_risk_score", "social_risk_score", "governance_risk_score"],
            ascending=[False, False, False],
        ).head(limit)

        return {
            "byCountry": [
                {
                    "country": str(row["country"]) if row["country"] else "Unknown",
                    "environmental": round(float(row["environmental"]), 2),
                    "social": round(float(row["social"]), 2),
                    "governance": round(float(row["governance"]), 2),
                }
                for _, row in by_country.iterrows()
            ],
            "topSuppliers": [
                {
                    "supplierId": int(row["supplier_id"]),
                    "supplierName": str(row.get("supplier_name") or "Unknown Supplier"),
                    "country": row.get("country"),
                    "environmental": round(float(row["environmental_risk_score"]), 2),
                    "social": round(float(row["social_risk_score"]), 2),
                    "governance": round(float(row["governance_risk_score"]), 2),
                }
                for _, row in top_suppliers.iterrows()
            ],
        }

    def get_trend_analysis(
        self,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> dict:
        filtered_risk_frame = self._get_filtered_risk_frame(country, commodity, tier, risk_level)
        supplier_ids = (
            set(filtered_risk_frame["supplier_id"].dropna().astype(int).tolist())
            if not filtered_risk_frame.empty
            else set()
        )

        transactions = self._load_full_transactions().copy()
        supplier_certs = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_certifications_file,
            "supplier_certifications",
        )
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )

        if supplier_ids:
            transactions = transactions[transactions["supplier_id"].isin(supplier_ids)]
            if not supplier_certs.empty and "supplier_id" in supplier_certs.columns:
                supplier_certs = supplier_certs[supplier_certs["supplier_id"].isin(supplier_ids)]
            if not supplier_commodity_map.empty and "supplier_id" in supplier_commodity_map.columns:
                supplier_commodity_map = supplier_commodity_map[
                    supplier_commodity_map["supplier_id"].isin(supplier_ids)
                ]
        elif country or commodity or tier or risk_level:
            transactions = transactions.iloc[0:0]
            supplier_certs = supplier_certs.iloc[0:0]
            supplier_commodity_map = supplier_commodity_map.iloc[0:0]

        operational = self._build_operational_trends(transactions)
        certification_timeline = self._build_certification_timeline(supplier_certs)
        country_trends = self._build_country_trends(transactions, filtered_risk_frame)
        commodity_trends = self._build_commodity_trends(
            transactions,
            supplier_commodity_map,
            commodities,
        )

        return {
            "operational": operational,
            "certificationTimeline": certification_timeline,
            "countryTrends": country_trends,
            "commodityTrends": commodity_trends,
        }

    def get_esg_distribution(self, bins: int = 20) -> list[dict]:
        esg = pd.DataFrame(self.dataset_service.get_esg())
        if esg.empty or "esg_score" not in esg.columns:
            return []

        scores = pd.to_numeric(esg["esg_score"], errors="coerce").dropna()
        if scores.empty:
            return []

        bin_count = max(1, bins)
        counts, edges = pd.cut(scores, bins=bin_count, retbins=True, include_lowest=True)
        value_counts = counts.value_counts(sort=False)

        histogram = []
        for interval, count in value_counts.items():
            start = float(interval.left)
            end = float(interval.right)
            histogram.append(
                {
                    "label": f"{start:.1f}-{end:.1f}",
                    "start": round(start, 1),
                    "end": round(end, 1),
                    "count": int(count),
                }
            )

        logger.info("Computed ESG distribution with %s bins", bin_count)
        return histogram

    def _build_histogram(self, values: pd.Series, bins: int) -> list[dict]:
        scores = pd.to_numeric(values, errors="coerce").dropna()
        if scores.empty:
            return []

        counts, edges = pd.cut(scores, bins=bins, retbins=True, include_lowest=True)
        value_counts = counts.value_counts(sort=False)

        histogram = []
        for interval, count in value_counts.items():
            start = float(interval.left)
            end = float(interval.right)
            histogram.append(
                {
                    "label": f"{start:.1f}-{end:.1f}",
                    "start": round(start, 1),
                    "end": round(end, 1),
                    "count": int(count),
                }
            )
        return histogram

    def _get_filtered_risk_frame(
        self,
        country: str | None = None,
        commodity: str | None = None,
        tier: str | None = None,
        risk_level: str | None = None,
    ) -> pd.DataFrame:
        risk_frame = self.risk_service._build_supplier_risk_frame()
        if risk_frame.empty:
            return risk_frame

        filtered = risk_frame.copy()
        if country:
            filtered = filtered[filtered["country"].astype(str).str.lower() == country.strip().lower()]
        if tier:
            filtered = filtered[filtered["tier"].astype(str).str.lower() == tier.strip().lower()]
        if risk_level:
            filtered = filtered[
                filtered["overall_risk_level"].astype(str).str.lower() == risk_level.strip().lower()
            ]
        if commodity:
            supplier_ids = self._supplier_ids_for_commodity(commodity)
            filtered = filtered[filtered["supplier_id"].isin(supplier_ids)]

        return filtered

    def _supplier_ids_for_commodity(self, commodity: str) -> set[int]:
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
            mask = frame["commodity_name"].astype(str).str.lower() == commodity.strip().lower()
        else:
            mask = frame["commodity_id"].astype(str).str.lower() == commodity.strip().lower()

        return {int(value) for value in frame.loc[mask, "supplier_id"].dropna().tolist()}

    def _build_operational_trends(self, transactions: pd.DataFrame) -> list[dict]:
        if transactions.empty or "date" not in transactions.columns:
            return []

        frame = transactions.copy()
        frame["date"] = pd.to_datetime(frame.get("date"), errors="coerce")
        frame = frame.dropna(subset=["date"])
        if frame.empty:
            return []

        frame["delivery_delay_days"] = pd.to_numeric(
            frame.get("delivery_delay_days"),
            errors="coerce",
        )
        frame["defect_rate"] = pd.to_numeric(frame.get("defect_rate"), errors="coerce")
        frame["cost_variance"] = pd.to_numeric(frame.get("cost_variance"), errors="coerce")
        frame["period"] = frame["date"].dt.to_period("M").astype(str)

        grouped = (
            frame.groupby("period")
            .agg(
                avgDelayDays=("delivery_delay_days", "mean"),
                avgDefectRatePct=("defect_rate", "mean"),
                avgCostVariancePct=("cost_variance", "mean"),
                transactionCount=("transaction_id", "count"),
            )
            .reset_index()
            .sort_values("period")
        )

        return [
            {
                "period": str(row["period"]),
                "avgDelayDays": round(float(row["avgDelayDays"]), 2)
                if pd.notna(row["avgDelayDays"])
                else 0.0,
                "avgDefectRatePct": round(float(row["avgDefectRatePct"]) * 100, 2)
                if pd.notna(row["avgDefectRatePct"])
                else 0.0,
                "avgCostVariancePct": round(float(row["avgCostVariancePct"]) * 100, 2)
                if pd.notna(row["avgCostVariancePct"])
                else 0.0,
                "transactionCount": int(row["transactionCount"]),
            }
            for _, row in grouped.iterrows()
        ]

    def _build_certification_timeline(self, supplier_certs: pd.DataFrame) -> list[dict]:
        if supplier_certs.empty:
            return []

        issued = supplier_certs.copy()
        issued["issue_date"] = pd.to_datetime(issued.get("issue_date"), errors="coerce")
        issued = issued.dropna(subset=["issue_date"])
        issued_counts = (
            issued.assign(period=issued["issue_date"].dt.to_period("M").astype(str))
            .groupby("period")
            .size()
            .rename("issuedCount")
        )

        expiring = supplier_certs.copy()
        expiring["expiry_date"] = pd.to_datetime(expiring.get("expiry_date"), errors="coerce")
        expiring = expiring.dropna(subset=["expiry_date"])
        if expiring.empty and issued_counts.empty:
            return []

        today = pd.Timestamp("2026-04-27")
        expiring_counts = (
            expiring.loc[expiring["expiry_date"].gt(today)]
            .assign(period=lambda frame: frame["expiry_date"].dt.to_period("M").astype(str))
            .groupby("period")
            .size()
            .rename("expiringCount")
        )
        expired_counts = (
            expiring.loc[expiring["expiry_date"].le(today)]
            .assign(period=lambda frame: frame["expiry_date"].dt.to_period("M").astype(str))
            .groupby("period")
            .size()
            .rename("expiredCount")
        )

        merged = pd.concat([issued_counts, expiring_counts, expired_counts], axis=1).fillna(0).reset_index()
        merged = merged.rename(columns={"index": "period"}).sort_values("period")
        return [
            {
                "period": str(row["period"]),
                "issuedCount": int(row.get("issuedCount", 0)),
                "expiringCount": int(row.get("expiringCount", 0)),
                "expiredCount": int(row.get("expiredCount", 0)),
            }
            for _, row in merged.iterrows()
        ]

    def _build_country_trends(
        self,
        transactions: pd.DataFrame,
        risk_frame: pd.DataFrame,
        limit: int = 4,
    ) -> list[dict]:
        if transactions.empty or risk_frame.empty or "country" not in risk_frame.columns:
            return []

        frame = transactions.copy()
        frame["date"] = pd.to_datetime(frame.get("date"), errors="coerce")
        frame["delivery_delay_days"] = pd.to_numeric(frame.get("delivery_delay_days"), errors="coerce")
        frame = frame.dropna(subset=["date", "delivery_delay_days"])
        if frame.empty:
            return []

        country_map = risk_frame[["supplier_id", "country"]].dropna(subset=["country"]).copy()
        top_countries = (
            country_map["country"].astype(str).value_counts().head(limit).index.tolist()
        )
        country_map = country_map[country_map["country"].isin(top_countries)]
        frame = frame.merge(country_map, on="supplier_id", how="inner")
        if frame.empty:
            return []

        frame["period"] = frame["date"].dt.to_period("M").astype(str)
        grouped = (
            frame.groupby(["country", "period"])
            .agg(value=("delivery_delay_days", "mean"))
            .reset_index()
            .sort_values(["country", "period"])
        )

        return [
            {
                "name": str(country_name),
                "points": [
                    {
                        "period": str(row["period"]),
                        "value": round(float(row["value"]), 2),
                    }
                    for _, row in group.iterrows()
                ],
            }
            for country_name, group in grouped.groupby("country")
        ]

    def _build_commodity_trends(
        self,
        transactions: pd.DataFrame,
        supplier_commodity_map: pd.DataFrame,
        commodities: pd.DataFrame,
        limit: int = 4,
    ) -> list[dict]:
        if transactions.empty or supplier_commodity_map.empty:
            return []

        frame = transactions.copy()
        frame["date"] = pd.to_datetime(frame.get("date"), errors="coerce")
        frame["delivery_delay_days"] = pd.to_numeric(frame.get("delivery_delay_days"), errors="coerce")
        frame = frame.dropna(subset=["date", "delivery_delay_days"])
        if frame.empty:
            return []

        commodity_map = supplier_commodity_map.copy()
        if not commodities.empty and {"commodity_id", "commodity_name"}.issubset(commodities.columns):
            commodity_map = commodity_map.merge(
                commodities[["commodity_id", "commodity_name"]],
                on="commodity_id",
                how="left",
            )
            commodity_column = "commodity_name"
        else:
            commodity_column = "commodity_id"

        top_commodities = (
            commodity_map[commodity_column]
            .dropna()
            .astype(str)
            .value_counts()
            .head(limit)
            .index.tolist()
        )
        commodity_map = commodity_map[commodity_map[commodity_column].astype(str).isin(top_commodities)]
        commodity_map = commodity_map[["supplier_id", commodity_column]].rename(
            columns={commodity_column: "commodity"}
        )

        frame = frame.merge(commodity_map, on="supplier_id", how="inner")
        if frame.empty:
            return []

        frame["period"] = frame["date"].dt.to_period("M").astype(str)
        grouped = (
            frame.groupby(["commodity", "period"])
            .agg(value=("delivery_delay_days", "mean"))
            .reset_index()
            .sort_values(["commodity", "period"])
        )

        return [
            {
                "name": str(commodity_name),
                "points": [
                    {
                        "period": str(row["period"]),
                        "value": round(float(row["value"]), 2),
                    }
                    for _, row in group.iterrows()
                ],
            }
            for commodity_name, group in grouped.groupby("commodity")
        ]


    def _load_full_transactions(self) -> pd.DataFrame:
        try:
            return self.dataset_service.load_full_transactions()
        except Exception as exc:
            logger.exception("Failed to load full transactions dataset", exc_info=exc)
            raise AppError("Unable to load transactions dataset", status_code=500) from exc

    def _build_geographic_exposure(
        self,
        risk_frame: pd.DataFrame,
        limit: int | None = 3,
    ) -> list[dict]:
        if risk_frame.empty or "country" not in risk_frame.columns:
            return []

        grouped = (
            risk_frame.groupby("country")
            .agg(
                supplierCount=("supplier_id", "count"),
                avgOverallRisk=("overall_risk_score", "mean"),
                avgOperationalRisk=("operational_risk_score", "mean"),
                avgEsgRisk=("esg_risk_score", "mean"),
            )
            .reset_index()
            .sort_values(["supplierCount", "avgOverallRisk"], ascending=[False, False])
        )
        if limit is not None:
            grouped = grouped.head(limit)

        return [
            {
                "country": str(row["country"]) if row["country"] else "Unknown",
                "supplierCount": int(row["supplierCount"]),
                "riskLevel": self._health_band(float(row["avgOverallRisk"]), reverse=False),
                "avgOverallRisk": round(float(row["avgOverallRisk"]), 2),
                "avgOperationalRisk": round(float(row["avgOperationalRisk"]), 2),
                "avgEsgRisk": round(float(row["avgEsgRisk"]), 2),
            }
            for _, row in grouped.iterrows()
        ]

    def _build_commodity_exposure(self, limit: int = 6) -> list[dict]:
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        commodities = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )
        if supplier_commodity_map.empty:
            return []

        frame = supplier_commodity_map.copy()
        if not commodities.empty and {"commodity_id", "commodity_name"}.issubset(commodities.columns):
            frame = frame.merge(
                commodities[["commodity_id", "commodity_name"]],
                on="commodity_id",
                how="left",
            )

        commodity_col = "commodity_name" if "commodity_name" in frame.columns else "commodity_id"
        grouped = (
            frame.groupby(commodity_col)
            .agg(supplierCount=("supplier_id", "nunique"))
            .reset_index()
            .rename(columns={commodity_col: "commodity"})
            .sort_values(["supplierCount", "commodity"], ascending=[False, True])
            .head(limit)
        )

        return [
            {
                "commodity": str(row["commodity"]) if pd.notna(row["commodity"]) else "Unknown",
                "supplierCount": int(row["supplierCount"]),
            }
            for _, row in grouped.iterrows()
        ]

    def _health_band(self, value: float, reverse: bool = False) -> str:
        if reverse:
            if value >= 65:
                return "Stable"
            if value >= 45:
                return "Watch"
            return "At Risk"

        if value >= 60:
            return "At Risk"
        if value >= 40:
            return "Watch"
        return "Stable"

    def _build_supplier_reason(self, supplier: dict) -> str:
        reasons = []
        if supplier.get("operationalRiskLevel") == "High":
            reasons.append("operational follow-up")
        if supplier.get("esgRiskLevel") == "High":
            reasons.append("ESG follow-up")
        if not reasons:
            reasons.append("risk review")
        return f"Prioritized for {', '.join(reasons)}."

    def _build_primary_driver(self, row: pd.Series) -> str:
        drivers = {
            "Operational": float(row.get("operational_risk_score") or 0.0),
            "ESG": float(row.get("esg_risk_score") or 0.0),
            "Certification": float(row.get("certification_gap_score") or 0.0),
            "Commodity": float(row.get("commodity_exposure_risk") or 0.0),
            "Country": float(row.get("country_risk_score") or 0.0),
            "Alerts": float(row.get("open_alert_severity") or 0.0),
            "Audits": float(row.get("audit_non_compliance_mean") or 0.0),
        }
        return max(drivers.items(), key=lambda item: item[1])[0]
