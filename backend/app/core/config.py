import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    app_name: str = "Supplier AI Intelligence API"
    app_version: str = "1.0.0"
    debug: bool = False

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def data_dir(self) -> Path:
        return self.project_root / "data"

    @property
    def uploads_dir(self) -> Path:
        return self.project_root / "uploads"

    @property
    def suppliers_file(self) -> Path:
        return self.data_dir / "suppliers_v2.csv"

    @property
    def esg_environmental_file(self) -> Path:
        return self.data_dir / "esg_environmental_v2.csv"

    @property
    def esg_social_file(self) -> Path:
        return self.data_dir / "esg_social_v2.csv"

    @property
    def esg_governance_file(self) -> Path:
        return self.data_dir / "esg_governance_v2.csv"

    @property
    def transactions_file(self) -> Path:
        return self.data_dir / "transactions_v2.csv"

    @property
    def alerts_file(self) -> Path:
        return self.data_dir / "alerts_v2.csv"

    @property
    def audits_file(self) -> Path:
        return self.data_dir / "audits_v2.csv"

    @property
    def certifications_file(self) -> Path:
        return self.data_dir / "certifications_v2.csv"

    @property
    def supplier_certifications_file(self) -> Path:
        return self.data_dir / "supplier_certifications_v2.csv"

    @property
    def commodities_file(self) -> Path:
        return self.data_dir / "commodities_v2.csv"

    @property
    def supplier_commodity_map_file(self) -> Path:
        return self.data_dir / "supplier_commodity_map_v2.csv"

    @property
    def supplier_features_file(self) -> Path:
        return self.data_dir / "supplier_features_v2.csv"

@lru_cache
def get_settings() -> Settings:
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    return Settings(
        app_name=os.getenv("APP_NAME", "Supplier AI Intelligence API"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        debug=os.getenv("DEBUG", "false").lower() == "true",
    )
