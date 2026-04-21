from pathlib import Path

import pandas as pd

from ..core.config import get_settings
from ..core.exceptions import AppError
from ..core.logging import get_logger

logger = get_logger(__name__)


class DatasetService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _read_csv(self, file_path: Path, dataset_name: str) -> pd.DataFrame:
        if not file_path.exists():
            raise AppError(f"{dataset_name} dataset not found", status_code=500)

        try:
            data_frame = pd.read_csv(file_path)
            data_frame = data_frame.where(pd.notna(data_frame), None)
            logger.info("Loaded %s dataset with %s rows", dataset_name, len(data_frame))
            return data_frame
        except Exception as exc:
            logger.exception("Failed to load %s dataset", dataset_name, exc_info=exc)
            raise AppError(f"Unable to load {dataset_name} dataset", status_code=500) from exc

    def get_suppliers(self) -> list[dict]:
        suppliers = self._read_csv(self.settings.suppliers_file, "suppliers")
        return suppliers.to_dict(orient="records")

    def get_esg(self) -> list[dict]:
        esg = self._read_csv(self.settings.esg_file, "esg")
        return esg.to_dict(orient="records")

    def get_transactions(self) -> list[dict]:
        transactions = self._read_csv(self.settings.transactions_file, "transactions")
        return transactions.head(100).to_dict(orient="records")

    def get_supplier_performance(self) -> list[dict]:
        transactions = self._read_csv(self.settings.transactions_file, "transactions")

        required_columns = {
            "supplier_id",
            "delivery_delay_days",
            "defect_rate",
            "cost_variance",
        }
        missing_columns = required_columns.difference(transactions.columns)
        if missing_columns:
            raise AppError(
                f"Transactions dataset missing columns: {', '.join(sorted(missing_columns))}",
                status_code=500,
            )

        performance = transactions.groupby("supplier_id").agg(
            avg_delay=("delivery_delay_days", "mean"),
            avg_defect=("defect_rate", "mean"),
            avg_cost_variance=("cost_variance", "mean"),
        ).reset_index()

        performance["risk_score"] = (
            performance["avg_delay"] * 0.4
            + performance["avg_defect"] * 100 * 0.4
            + abs(performance["avg_cost_variance"]) * 0.2
        )

        logger.info("Computed supplier performance for %s suppliers", len(performance))
        return performance.to_dict(orient="records")
