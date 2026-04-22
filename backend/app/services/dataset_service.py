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
        suppliers = self._normalize_suppliers(suppliers)
        return suppliers.to_dict(orient="records")

    def get_esg(self) -> list[dict]:
        esg = self._load_esg_frame()
        return esg.to_dict(orient="records")

    def get_transactions(self) -> list[dict]:
        transactions = self._load_transactions_frame()
        return transactions.head(100).to_dict(orient="records")

    def get_supplier_performance(self) -> list[dict]:
        transactions = self._load_transactions_frame()

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

    def load_full_transactions(self) -> pd.DataFrame:
        return self._load_transactions_frame()

    def load_suppliers_frame(self) -> pd.DataFrame:
        suppliers = self._read_csv(self.settings.suppliers_file, "suppliers")
        return self._normalize_suppliers(suppliers)

    def load_esg_frame(self) -> pd.DataFrame:
        return self._load_esg_frame()

    def load_optional_csv(self, file_path: Path, dataset_name: str) -> pd.DataFrame:
        if not file_path.exists():
            logger.warning("Optional dataset %s was not found at %s", dataset_name, file_path)
            return pd.DataFrame()
        return self._read_csv(file_path, dataset_name)

    def _load_transactions_frame(self) -> pd.DataFrame:
        transactions = self._read_csv(self.settings.transactions_file, "transactions")
        return self._normalize_transactions(transactions)

    def _load_esg_frame(self) -> pd.DataFrame:
        environmental = self._read_csv(self.settings.esg_environmental_file, "esg_environmental")
        social = self._read_csv(self.settings.esg_social_file, "esg_social")
        governance = self._read_csv(self.settings.esg_governance_file, "esg_governance")

        esg = environmental.merge(social, on="supplier_id", how="outer").merge(
            governance,
            on="supplier_id",
            how="outer",
        )

        numeric_columns = [column for column in esg.columns if column != "supplier_id"]
        if numeric_columns:
            numeric_frame = esg[numeric_columns].apply(pd.to_numeric, errors="coerce")
            esg["esg_score"] = ((1 - numeric_frame.mean(axis=1, skipna=True)) * 100).round(1)
            esg["carbon_emission"] = numeric_frame.get("carbon")
            esg["water_usage"] = numeric_frame.get("water")
            esg["labor_violations"] = numeric_frame.get("labor")

            land_series = numeric_frame.get("land")
            if land_series is not None:
                esg["land_use_risk"] = land_series.apply(self._classify_land_use_risk)
            else:
                esg["land_use_risk"] = None
        else:
            esg["esg_score"] = None
            esg["carbon_emission"] = None
            esg["water_usage"] = None
            esg["labor_violations"] = None
            esg["land_use_risk"] = None

        return esg.where(pd.notna(esg), None)

    def _normalize_suppliers(self, suppliers: pd.DataFrame) -> pd.DataFrame:
        for column in ["category", "certification"]:
            if column not in suppliers.columns:
                suppliers[column] = None
        return suppliers

    def _normalize_transactions(self, transactions: pd.DataFrame) -> pd.DataFrame:
        rename_map = {"delay_days": "delivery_delay_days"}
        transactions = transactions.rename(columns=rename_map)
        return transactions

    def _classify_land_use_risk(self, value: float | None) -> str | None:
        if pd.isna(value):
            return None
        if value >= 0.66:
            return "High"
        if value >= 0.33:
            return "Medium"
        return "Low"
