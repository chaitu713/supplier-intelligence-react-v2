import os
from datetime import date, timedelta
from pathlib import Path
import json
import math
import io

import pandas as pd
import pdfplumber
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from google import genai

SUPPORTED_COUNTRIES = [
    "India",
    "Indonesia",
    "Brazil",
    "USA",
    "China",
    "Vietnam",
    "Germany",
    "Thailand",
    "Malaysia",
    "Singapore",
    "Philippines",
    "Mexico",
    "Netherlands",
    "France",
    "UK",
]


class OnboardingService:
    def __init__(self) -> None:
        endpoint = os.getenv("AZURE_DOC_INTELLIGENCE_ENDPOINT") or os.getenv(
            "DOCUMENT_INTELLIGENCE_ENDPOINT"
        )
        key = os.getenv("AZURE_DOC_INTELLIGENCE_KEY") or os.getenv("DOCUMENT_INTELLIGENCE_KEY")
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.data_dir = Path(__file__).resolve().parents[3] / "data"

        self.client = None
        if endpoint and key:
            self.client = DocumentAnalysisClient(
                endpoint=endpoint,
                credential=AzureKeyCredential(key),
            )
        self.gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

    def extract_text(self, file_bytes: bytes) -> str:
        if self.client:
            try:
                poller = self.client.begin_analyze_document("prebuilt-document", file_bytes)
                result = poller.result()

                lines: list[str] = []
                for page in result.pages:
                    for line in page.lines:
                        lines.append(line.content)

                extracted = "\n".join(lines).strip()
                if extracted:
                    return extracted
            except Exception:
                pass

        fallback_text = self._extract_text_with_pdfplumber(file_bytes)
        if fallback_text:
            return fallback_text

        raise Exception("Document extraction failed")

    def _extract_text_with_pdfplumber(self, file_bytes: bytes) -> str:
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                page_text = [(page.extract_text() or "").strip() for page in pdf.pages]
            return "\n".join(text for text in page_text if text).strip()
        except Exception:
            return ""

    def _map_extracted_data(self, text: str) -> dict:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        supplier_name = lines[0] if lines else None

        lowered_text = text.lower()

        country = None
        for candidate in SUPPORTED_COUNTRIES:
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
        tier = data.get("tier")
        parent_supplier_id = data.get("parent_supplier_id")
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

        if tier in {"Tier 2", "Tier 3"} and parent_supplier_id is None:
            errors.append("linked supplier is required for Tier 2 and Tier 3 suppliers")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def _get_next_id(self, df, column_name):
        if df.empty:
            return 1
        return int(df[column_name].max()) + 1

    def _parse_float(self, value: str | float | int | None) -> float | None:
        if value is None:
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if math.isnan(number):
            return None
        return number

    def _parse_int(self, value: str | int | None) -> int | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        try:
            return int(text)
        except ValueError:
            return None

    def _parse_date(self, value: str | None, fallback: date) -> str:
        if not value:
            return fallback.isoformat()
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            return fallback.isoformat()

    def _normalize_certification_rows(self, value: str | list[dict] | None) -> list[dict]:
        if value is None:
            return []

        parsed: list[dict] = []
        if isinstance(value, list):
            parsed = value
        else:
            text = value.strip()
            if not text:
                return []
            try:
                loaded = json.loads(text)
            except json.JSONDecodeError:
                return []
            if isinstance(loaded, list):
                parsed = loaded

        normalized_rows: list[dict] = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            normalized_rows.append(
                {
                    "name": name,
                    "issue_date": str(item.get("issue_date", "")).strip(),
                    "expiry_date": str(item.get("expiry_date", "")).strip(),
                    "status": str(item.get("status", "Pending")).strip() or "Pending",
                }
            )
        return normalized_rows

    def _append_default_row(self, df: pd.DataFrame, supplier_id: int) -> pd.DataFrame:
        new_row: dict[str, object] = {"supplier_id": supplier_id}
        for column in df.columns:
            if column == "supplier_id":
                continue
            numeric_series = pd.to_numeric(df[column], errors="coerce")
            numeric_mean = numeric_series.mean(skipna=True)
            new_row[column] = None if pd.isna(numeric_mean) else float(numeric_mean)
        return pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

    def _build_starter_audit_row(
        self,
        audits_df: pd.DataFrame,
        supplier_id: int,
        onboarding_date: str,
        data: dict,
    ) -> dict:
        certifications_count = len(data.get("certifications", []))
        commodities_count = len(data.get("commodities", []))
        tier = (data.get("tier") or "").strip().lower()
        size = (data.get("size") or "").strip().lower()

        # Start from a conservative baseline and adjust slightly from onboarding context.
        score = 78.0
        score += min(certifications_count, 3) * 4.0
        score += min(commodities_count, 2) * 1.5
        if tier == "tier 1":
            score -= 4.0
        elif tier == "tier 3":
            score += 2.0
        if size == "large":
            score -= 2.0
        elif size == "small":
            score += 1.0
        score = max(55.0, min(96.0, round(score, 2)))

        non_compliance = 3
        if certifications_count >= 2:
            non_compliance -= 1
        if certifications_count == 0:
            non_compliance += 1
        if tier == "tier 1":
            non_compliance += 1
        non_compliance = max(0, min(5, non_compliance))

        return {
            "audit_id": self._get_next_id(audits_df, "audit_id"),
            "supplier_id": supplier_id,
            "audit_date": onboarding_date,
            "type": "Initial",
            "score": score,
            "non_compliance": non_compliance,
        }

    def _generate_ai_assistance(self, data: dict, validation: dict, raw_text: str) -> dict | None:
        issues = validation.get("errors", []) + validation.get("warnings", [])
        if not issues or not self.gemini_client:
            return None

        prompt = f"""
You are helping with AI-assisted supplier onboarding remediation.

Current extracted fields:
- supplier_name: {data.get("supplier_name")}
- country: {data.get("country")}
- commodities: {data.get("commodities")}
- certifications: {data.get("certifications")}

Validation:
- errors: {validation.get("errors", [])}
- warnings: {validation.get("warnings", [])}

Raw extracted text:
{raw_text[:3000]}

Supported countries:
{", ".join(SUPPORTED_COUNTRIES)}

Supported commodities:
Palm Oil, Cocoa, Coffee, Rubber, Wood, Soya

Supported certifications:
RSPO, Rainforest Alliance, FSC, PEFC, Fairtrade, ISO14001, ISO22000, GMP, HACCP

Return strict JSON with this shape:
{{
  "summary": "short explanation",
  "canProceed": true,
  "suggestedFields": {{
    "supplier_name": string or null,
    "country": string or null,
    "possibleCountries": [strings],
    "commodities": [strings],
    "certifications": [strings]
  }},
  "actions": ["short action", "short action"],
  "confidence": "low|medium|high"
}}

Rules:
- Suggest only from the supported countries, commodities, and certifications.
- If country cannot be stated confidently, return `country` as null and populate `possibleCountries` with up to 3 likely options.
- If the text does not support a field, return null or an empty list.
- Keep actions practical and short.
- canProceed should be false only when required data is still genuinely missing.
"""

        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                contents=prompt,
            )
            text = self._extract_json_block((response.text or "").strip())
            result = json.loads(text)
            if not isinstance(result, dict):
                return None
            return {
                "summary": result.get("summary") or "AI suggestions are available for the extracted data.",
                "canProceed": bool(result.get("canProceed", False)),
                "suggestedFields": {
                    "supplier_name": (result.get("suggestedFields") or {}).get("supplier_name"),
                    "country": (result.get("suggestedFields") or {}).get("country"),
                    "possibleCountries": (result.get("suggestedFields") or {}).get(
                        "possibleCountries", []
                    ),
                    "commodities": (result.get("suggestedFields") or {}).get("commodities", []),
                    "certifications": (result.get("suggestedFields") or {}).get(
                        "certifications", []
                    ),
                },
                "actions": result.get("actions") or [],
                "confidence": result.get("confidence") or "medium",
            }
        except Exception:
            return None

    def _extract_json_block(self, text: str) -> str:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()

        if cleaned.startswith("{") and cleaned.endswith("}"):
            return cleaned

        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return cleaned[start : end + 1]

        return cleaned

    def _persist_data(self, data: dict):
        try:
            suppliers_path = self.data_dir / "suppliers_v2.csv"
            supplier_commodity_map_path = self.data_dir / "supplier_commodity_map_v2.csv"
            supplier_certifications_path = self.data_dir / "supplier_certifications_v2.csv"
            commodities_path = self.data_dir / "commodities_v2.csv"
            certifications_path = self.data_dir / "certifications_v2.csv"
            supplier_features_path = self.data_dir / "supplier_features_v2.csv"
            esg_environmental_path = self.data_dir / "esg_environmental_v2.csv"
            esg_social_path = self.data_dir / "esg_social_v2.csv"
            esg_governance_path = self.data_dir / "esg_governance_v2.csv"
            audits_path = self.data_dir / "audits_v2.csv"

            suppliers_df = pd.read_csv(suppliers_path)
            supplier_commodity_map_df = pd.read_csv(supplier_commodity_map_path)
            supplier_certifications_df = pd.read_csv(supplier_certifications_path)
            commodities_df = pd.read_csv(commodities_path)
            certifications_df = pd.read_csv(certifications_path)
            supplier_features_df = pd.read_csv(supplier_features_path)
            esg_environmental_df = pd.read_csv(esg_environmental_path)
            esg_social_df = pd.read_csv(esg_social_path)
            esg_governance_df = pd.read_csv(esg_governance_path)
            audits_df = pd.read_csv(audits_path)

            supplier_id = self._get_next_id(suppliers_df, "supplier_id")
            today = date.today()
            expiry_date = today + timedelta(days=365)
            onboarding_date = self._parse_date(data.get("onboarding_date"), today)

            new_supplier_row = {column: None for column in suppliers_df.columns}
            new_supplier_row["supplier_id"] = supplier_id
            new_supplier_row["supplier_name"] = data["supplier_name"]
            new_supplier_row["country"] = data["country"]
            if "tier" in new_supplier_row:
                new_supplier_row["tier"] = data.get("tier")
            if "parent_supplier_id" in new_supplier_row:
                new_supplier_row["parent_supplier_id"] = data.get("parent_supplier_id")
            if "size" in new_supplier_row:
                new_supplier_row["size"] = data.get("size")
            if "annual_revenue" in new_supplier_row:
                new_supplier_row["annual_revenue"] = self._parse_float(data.get("annual_revenue"))
            if "onboarding_date" in new_supplier_row:
                new_supplier_row["onboarding_date"] = onboarding_date
            if "dependency_score" in new_supplier_row:
                mean_value = pd.to_numeric(suppliers_df["dependency_score"], errors="coerce").mean()
                new_supplier_row["dependency_score"] = None if pd.isna(mean_value) else float(mean_value)
            if "criticality_score" in new_supplier_row:
                mean_value = pd.to_numeric(suppliers_df["criticality_score"], errors="coerce").mean()
                new_supplier_row["criticality_score"] = None if pd.isna(mean_value) else float(mean_value)
            if "status" in new_supplier_row:
                new_supplier_row["status"] = data.get("status") or "Active"

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
            certification_row_map = {
                row["name"].lower(): row for row in data.get("certification_rows", [])
            }
            for certification_name in data.get("certifications", []):
                certification_match = certifications_df[
                    certifications_df["cert_name"].astype(str).str.lower() == certification_name.lower()
                ]
                if certification_match.empty:
                    continue

                metadata = certification_row_map.get(certification_name.lower(), {})
                issue_value = self._parse_date(metadata.get("issue_date"), today)
                expiry_value = self._parse_date(metadata.get("expiry_date"), expiry_date)
                status_value = metadata.get("status") or "Pending"

                certification_rows.append(
                    {
                        "id": next_certification_id,
                        "supplier_id": supplier_id,
                        "cert_id": int(certification_match.iloc[0]["cert_id"]),
                        "issue_date": issue_value,
                        "expiry_date": expiry_value,
                        "status": status_value,
                    }
                )
                next_certification_id += 1

            if certification_rows:
                supplier_certifications_df = pd.concat(
                    [supplier_certifications_df, pd.DataFrame(certification_rows)],
                    ignore_index=True,
                )

            supplier_features_df = self._append_default_row(supplier_features_df, supplier_id)
            esg_environmental_df = self._append_default_row(esg_environmental_df, supplier_id)
            esg_social_df = self._append_default_row(esg_social_df, supplier_id)
            esg_governance_df = self._append_default_row(esg_governance_df, supplier_id)
            audits_df = pd.concat(
                [
                    audits_df,
                    pd.DataFrame(
                        [
                            self._build_starter_audit_row(
                                audits_df=audits_df,
                                supplier_id=supplier_id,
                                onboarding_date=onboarding_date,
                                data=data,
                            )
                        ]
                    ),
                ],
                ignore_index=True,
            )

            suppliers_df.to_csv(suppliers_path, index=False)
            supplier_commodity_map_df.to_csv(supplier_commodity_map_path, index=False)
            supplier_certifications_df.to_csv(supplier_certifications_path, index=False)
            supplier_features_df.to_csv(supplier_features_path, index=False)
            esg_environmental_df.to_csv(esg_environmental_path, index=False)
            esg_social_df.to_csv(esg_social_path, index=False)
            esg_governance_df.to_csv(esg_governance_path, index=False)
            audits_df.to_csv(audits_path, index=False)

            return supplier_id
        except Exception as exc:
            raise Exception("Failed to persist onboarding data") from exc

    def process_document(self, file_bytes: bytes) -> dict:
        raw_text = self.extract_text(file_bytes)
        mapped_data = self._map_extracted_data(raw_text)
        validation = self._validate_data(mapped_data)
        ai_assistance = self._generate_ai_assistance(mapped_data, validation, raw_text)

        return {
            "message": "Upload successful",
            "supplier_id": None,
            "raw_text": raw_text[:1000],
            "supplier_name": mapped_data["supplier_name"],
            "country": mapped_data["country"],
            "commodities": mapped_data["commodities"],
            "certifications": mapped_data["certifications"],
            "esg": mapped_data["esg"],
            "validation": validation,
            "ai_assistance": ai_assistance,
        }

    def process_submission(
        self,
        supplier_name: str | None,
        country: str | None,
        tier: str | None,
        size: str | None,
        annual_revenue: str | None,
        onboarding_date: str | None,
        status: str | None,
        parent_supplier_id: str | None,
        commodities: str | list[str] | None,
        certifications: str | list[str] | None,
        certification_rows: str | None,
    ) -> dict:
        mapped_data = {
            "supplier_name": supplier_name.strip() if supplier_name else None,
            "country": country.strip() if country else None,
            "tier": tier.strip() if tier else None,
            "size": size.strip() if size else None,
            "annual_revenue": self._parse_float(annual_revenue),
            "onboarding_date": onboarding_date.strip() if onboarding_date else None,
            "status": status.strip() if status else None,
            "parent_supplier_id": self._parse_int(parent_supplier_id),
            "commodities": self._normalize_list_input(commodities),
            "certifications": self._normalize_list_input(certifications),
            "certification_rows": self._normalize_certification_rows(certification_rows),
            "esg": {
                "carbon": None,
                "water": None,
                "labor": None,
            },
        }
        validation = self._validate_data(mapped_data)
        ai_assistance = self._generate_ai_assistance(mapped_data, validation, "")
        supplier_id = None
        message = "Validation failed"

        if validation["is_valid"]:
            supplier_id = self._persist_data(mapped_data)
            message = "Supplier onboarded successfully"

        return {
            "message": message,
            "supplier_id": supplier_id,
            "raw_text": "",
            "supplier_name": mapped_data["supplier_name"],
            "country": mapped_data["country"],
            "tier": mapped_data["tier"],
            "size": mapped_data["size"],
            "annual_revenue": mapped_data["annual_revenue"],
            "onboarding_date": mapped_data["onboarding_date"],
            "status": mapped_data["status"],
            "parent_supplier_id": mapped_data["parent_supplier_id"],
            "commodities": mapped_data["commodities"],
            "certifications": mapped_data["certifications"],
            "certification_rows": mapped_data["certification_rows"],
            "esg": mapped_data["esg"],
            "validation": validation,
            "ai_assistance": ai_assistance,
        }

    def _normalize_list_input(self, value: str | list[str] | None) -> list[str]:
        if value is None:
            return []

        if isinstance(value, list):
            return [item.strip() for item in value if str(item).strip()]

        text = value.strip()
        if not text:
            return []

        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass

        return [item.strip() for item in text.split(",") if item.strip()]


onboarding_service = OnboardingService()
