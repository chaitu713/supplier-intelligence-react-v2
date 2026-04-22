import os
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential


class OnboardingService:
    def __init__(self) -> None:
        endpoint = os.getenv("AZURE_DOC_INTELLIGENCE_ENDPOINT")
        key = os.getenv("AZURE_DOC_INTELLIGENCE_KEY")
        self.data_dir = Path(__file__).resolve().parents[3] / "data"

        self.client = None
        if endpoint and key:
            self.client = DocumentAnalysisClient(
                endpoint=endpoint,
                credential=AzureKeyCredential(key),
            )

    def extract_text(self, file_bytes: bytes) -> str:
        if not self.client:
            raise Exception("Document extraction failed")

        try:
            poller = self.client.begin_analyze_document("prebuilt-document", file_bytes)
            result = poller.result()

            lines: list[str] = []
            for page in result.pages:
                for line in page.lines:
                    lines.append(line.content)

            return "\n".join(lines)
        except Exception as exc:
            raise Exception("Document extraction failed") from exc

    def _map_extracted_data(self, text: str) -> dict:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        supplier_name = lines[0] if lines else None

        lowered_text = text.lower()

        country = None
        for candidate in ["India", "Indonesia", "Brazil", "USA", "China", "Vietnam", "Germany"]:
            if candidate.lower() in lowered_text:
                country = candidate
                break

        commodities = []
        for keyword, label in [
            ("palm oil", "Palm Oil"),
            ("cocoa", "Cocoa"),
            ("coffee", "Coffee"),
            ("rubber", "Rubber"),
            ("wood", "Wood"),
            ("soya", "Soya"),
        ]:
            if keyword in lowered_text:
                commodities.append(label)

        certifications = []
        for keyword, label in [
            ("rspo", "RSPO"),
            ("rainforest", "Rainforest Alliance"),
            ("fsc", "FSC"),
            ("pefc", "PEFC"),
            ("fairtrade", "Fairtrade"),
            ("iso 14001", "ISO14001"),
        ]:
            if keyword in lowered_text:
                certifications.append(label)

        return {
            "supplier_name": supplier_name,
            "country": country,
            "commodities": commodities,
            "certifications": certifications,
            "esg": {
                "carbon": None,
                "water": None,
                "labor": None,
            },
        }

    def _validate_data(self, data: dict) -> dict:
        errors: list[str] = []
        warnings: list[str] = []

        supplier_name = data.get("supplier_name")
        country = data.get("country")
        commodities = data.get("commodities", [])
        certifications = data.get("certifications", [])

        if supplier_name is None or not str(supplier_name).strip():
            errors.append("supplier_name is required")

        if country is None:
            errors.append("country is required")

        if not commodities:
            errors.append("at least one commodity is required")

        if not certifications:
            warnings.append("no certifications detected")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def _get_next_id(self, df, column_name):
        if df.empty:
            return 1
        return int(df[column_name].max()) + 1

    def _persist_data(self, data: dict):
        try:
            suppliers_path = self.data_dir / "suppliers_v2.csv"
            supplier_commodity_map_path = self.data_dir / "supplier_commodity_map_v2.csv"
            supplier_certifications_path = self.data_dir / "supplier_certifications_v2.csv"
            commodities_path = self.data_dir / "commodities_v2.csv"
            certifications_path = self.data_dir / "certifications_v2.csv"

            suppliers_df = pd.read_csv(suppliers_path)
            supplier_commodity_map_df = pd.read_csv(supplier_commodity_map_path)
            supplier_certifications_df = pd.read_csv(supplier_certifications_path)
            commodities_df = pd.read_csv(commodities_path)
            certifications_df = pd.read_csv(certifications_path)

            supplier_id = self._get_next_id(suppliers_df, "supplier_id")
            today = date.today()
            expiry_date = today + timedelta(days=365)

            new_supplier_row = {column: None for column in suppliers_df.columns}
            new_supplier_row["supplier_id"] = supplier_id
            new_supplier_row["supplier_name"] = data["supplier_name"]
            new_supplier_row["country"] = data["country"]
            if "onboarding_date" in new_supplier_row:
                new_supplier_row["onboarding_date"] = today.isoformat()
            if "status" in new_supplier_row:
                new_supplier_row["status"] = "Active"

            suppliers_df = pd.concat(
                [suppliers_df, pd.DataFrame([new_supplier_row])],
                ignore_index=True,
            )

            commodity_rows = []
            for commodity_name in data.get("commodities", []):
                commodity_match = commodities_df[
                    commodities_df["commodity_name"].astype(str).str.lower() == commodity_name.lower()
                ]
                if commodity_match.empty:
                    continue

                commodity_rows.append(
                    {
                        "supplier_id": supplier_id,
                        "commodity_id": int(commodity_match.iloc[0]["commodity_id"]),
                        "volume": 0,
                    }
                )

            if commodity_rows:
                supplier_commodity_map_df = pd.concat(
                    [supplier_commodity_map_df, pd.DataFrame(commodity_rows)],
                    ignore_index=True,
                )

            next_certification_id = self._get_next_id(supplier_certifications_df, "id")
            certification_rows = []
            for certification_name in data.get("certifications", []):
                certification_match = certifications_df[
                    certifications_df["cert_name"].astype(str).str.lower() == certification_name.lower()
                ]
                if certification_match.empty:
                    continue

                certification_rows.append(
                    {
                        "id": next_certification_id,
                        "supplier_id": supplier_id,
                        "cert_id": int(certification_match.iloc[0]["cert_id"]),
                        "issue_date": today.isoformat(),
                        "expiry_date": expiry_date.isoformat(),
                        "status": "Verified",
                    }
                )
                next_certification_id += 1

            if certification_rows:
                supplier_certifications_df = pd.concat(
                    [supplier_certifications_df, pd.DataFrame(certification_rows)],
                    ignore_index=True,
                )

            suppliers_df.to_csv(suppliers_path, index=False)
            supplier_commodity_map_df.to_csv(supplier_commodity_map_path, index=False)
            supplier_certifications_df.to_csv(supplier_certifications_path, index=False)

            return supplier_id
        except Exception as exc:
            raise Exception("Failed to persist onboarding data") from exc

    def process_document(self, file_bytes: bytes) -> dict:
        raw_text = self.extract_text(file_bytes)
        mapped_data = self._map_extracted_data(raw_text)
        validation = self._validate_data(mapped_data)
        supplier_id = None
        message = "Validation failed"

        if validation["is_valid"]:
            supplier_id = self._persist_data(mapped_data)
            message = "Supplier onboarded successfully"

        return {
            "message": message,
            "supplier_id": supplier_id,
            "raw_text": raw_text[:1000],
            "supplier_name": mapped_data["supplier_name"],
            "country": mapped_data["country"],
            "commodities": mapped_data["commodities"],
            "certifications": mapped_data["certifications"],
            "esg": mapped_data["esg"],
            "validation": validation,
        }


onboarding_service = OnboardingService()
