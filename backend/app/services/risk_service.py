import pandas as pd

from ..core.exceptions import AppError
from ..core.logging import get_logger
from .dataset_service import DatasetService

logger = get_logger(__name__)


class RiskService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()

    def get_risk_overview(self) -> dict:
        performance = self._load_performance_frame()

        high_risk = performance[performance["risk_score"] > 8]
        medium_risk = performance[
            (performance["risk_score"] > 5) & (performance["risk_score"] <= 8)
        ]
        low_risk = performance[performance["risk_score"] <= 5]

        return {
            "highRiskCount": int(len(high_risk)),
            "mediumRiskCount": int(len(medium_risk)),
            "lowRiskCount": int(len(low_risk)),
            "avgRiskScore": round(float(performance["risk_score"].mean()), 2)
            if not performance.empty
            else 0.0,
        }

    def get_risk_distribution(self, bins: int = 7) -> list[dict]:
        performance = self._load_performance_frame()
        if performance.empty:
            return []

        scores = pd.to_numeric(performance["risk_score"], errors="coerce").dropna()
        if scores.empty:
            return []

        value_counts = pd.cut(scores, bins=max(1, bins), include_lowest=True).value_counts(
            sort=False
        )

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

    def get_risk_segmentation(self) -> list[dict]:
        performance = self._load_performance_frame()
        if performance.empty:
            return []

        high = int((performance["risk_score"] > 8).sum())
        medium = int(((performance["risk_score"] > 5) & (performance["risk_score"] <= 8)).sum())
        low = int((performance["risk_score"] <= 5).sum())

        return [
            {"riskLevel": "High", "supplierCount": high},
            {"riskLevel": "Medium", "supplierCount": medium},
            {"riskLevel": "Low", "supplierCount": low},
        ]

    def get_top_risk_suppliers(self, limit: int = 10) -> list[dict]:
        performance = self._load_performance_frame()
        if performance.empty:
            return []

        top_risk = (
            performance[performance["risk_score"] > 8]
            .sort_values("risk_score", ascending=False)
            .head(limit)
            .copy()
        )

        return [
            {
                "supplierId": int(row["supplier_id"]),
                "supplierName": row["supplier_name"],
                "country": row.get("country"),
                "category": row.get("category"),
                "avgDelay": round(float(row["avg_delay"]), 2),
                "avgDefect": round(float(row["avg_defect"]), 4),
                "avgCostVariance": round(float(row["avg_cost_variance"]), 2),
                "riskScore": round(float(row["risk_score"]), 2),
                "riskLevel": self._classify_operational_risk(float(row["risk_score"])),
            }
            for _, row in top_risk.iterrows()
        ]

    def run_due_diligence(self, supplier_id: int) -> dict:
        suppliers = pd.DataFrame(self.dataset_service.get_suppliers())
        performance = self._load_performance_frame(suppliers=suppliers)
        esg = pd.DataFrame(self.dataset_service.get_esg())

        supplier_rows = performance[performance["supplier_id"] == supplier_id]
        if supplier_rows.empty:
            raise AppError("Supplier not found in risk dataset", status_code=404)

        supplier_name = str(supplier_rows.iloc[0]["supplier_name"])

        try:
            try:
                from backend.due_diligence_agent import run_due_diligence
            except ImportError:
                from due_diligence_agent import run_due_diligence

            result = run_due_diligence(supplier_name, performance, esg, suppliers)
        except Exception as exc:
            logger.exception("Due diligence evaluation failed", exc_info=exc)
            raise AppError("Unable to run due diligence analysis", status_code=500) from exc

        return {
            "supplier": result["supplier"],
            "opRisk": result["op_risk"],
            "esgRisk": result["esg_risk"],
            "overall": result["overall"],
            "issues": result["issues"],
            "aiSummary": result["ai_summary"],
        }

    def _load_performance_frame(self, suppliers: pd.DataFrame | None = None) -> pd.DataFrame:
        performance = pd.DataFrame(self.dataset_service.get_supplier_performance())
        supplier_frame = suppliers if suppliers is not None else pd.DataFrame(self.dataset_service.get_suppliers())

        if performance.empty:
            return performance

        supplier_columns = [
            column
            for column in ["supplier_id", "supplier_name", "country", "category"]
            if column in supplier_frame.columns
        ]
        if supplier_columns:
            performance = performance.merge(
                supplier_frame[supplier_columns],
                on="supplier_id",
                how="left",
            )

        performance["risk_score"] = pd.to_numeric(performance["risk_score"], errors="coerce")
        return performance

    def _classify_operational_risk(self, risk_score: float) -> str:
        if risk_score > 8:
            return "High"
        if risk_score > 5:
            return "Medium"
        return "Low"
