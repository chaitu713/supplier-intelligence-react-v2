import pandas as pd

from ..core.exceptions import AppError
from ..core.logging import get_logger
from .dataset_service import DatasetService

logger = get_logger(__name__)


class AnalyticsService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()

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
