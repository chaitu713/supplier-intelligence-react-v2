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
        return self.data_dir / "suppliers.csv"

    @property
    def esg_file(self) -> Path:
        return self.data_dir / "esg_metrics.csv"

    @property
    def transactions_file(self) -> Path:
        return self.data_dir / "transactions.csv"

    @property
    def document_history_file(self) -> Path:
        return self.data_dir / "document_history.csv"


@lru_cache
def get_settings() -> Settings:
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    return Settings(
        app_name=os.getenv("APP_NAME", "Supplier AI Intelligence API"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        debug=os.getenv("DEBUG", "false").lower() == "true",
    )
