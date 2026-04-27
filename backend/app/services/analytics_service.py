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
