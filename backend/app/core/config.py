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
    auth_enabled: bool = False
    auth_trust_bearer_jwt: bool = False
    dev_user_id: str = "local_developer"
    dev_user_roles: tuple[str, ...] = (
        "ai_user",
        "reviewer",
        "supplier_operator",
        "compliance_manager",
        "model_admin",
    )
    database_url: str | None = None
    blob_connection_string: str | None = None
    blob_container_name: str = "supplier-documents"
    rag_enabled: bool = True
    rag_top_k: int = 5
    rag_embedding_provider: str = "none"
    rag_embedding_model: str = "text-embedding-3-small"
    azure_openai_embedding_deployment: str | None = None

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
        auth_enabled=os.getenv("AUTH_ENABLED", "false").lower() == "true",
        auth_trust_bearer_jwt=os.getenv("AUTH_TRUST_BEARER_JWT", "false").lower() == "true",
        dev_user_id=os.getenv("DEV_USER_ID", "local_developer"),
        dev_user_roles=tuple(
            role.strip()
            for role in os.getenv(
                "DEV_USER_ROLES",
                "ai_user,reviewer,supplier_operator,compliance_manager,model_admin",
            ).split(",")
            if role.strip()
        ),
        database_url=os.getenv("DATABASE_URL") or None,
        blob_connection_string=os.getenv("BLOB_CONNECTION_STRING") or None,
        blob_container_name=os.getenv("BLOB_CONTAINER_NAME", "supplier-documents"),
        rag_enabled=os.getenv("RAG_ENABLED", "true").lower() == "true",
        rag_top_k=int(os.getenv("RAG_TOP_K", "5")),
        rag_embedding_provider=os.getenv("RAG_EMBEDDING_PROVIDER", "none").strip().lower(),
        rag_embedding_model=os.getenv("RAG_EMBEDDING_MODEL", "text-embedding-3-small"),
        azure_openai_embedding_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT") or None,
    )
