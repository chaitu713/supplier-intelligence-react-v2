import os
from datetime import date, datetime, timedelta
from pathlib import Path
import json
import math
import io
import re
import shutil
import uuid

import pandas as pd
import pdfplumber
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

from ..ai.guardrails import GuardrailViolation
from ..ai.output_validation import validate_onboarding_assistance
from ..ai.prompt_registry import get_prompt_policy_block
from .ai_gateway import AiGatewayError, AiTextRequest, generate_ai_text
from .ai_review_queue import add_review_item

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

EUDR_COMMODITIES = {"Palm Oil", "Cocoa", "Coffee", "Rubber", "Wood", "Soya"}
HIGH_LAND_RISK_COUNTRIES = {"Brazil", "Indonesia", "Malaysia", "Thailand", "Vietnam"}
ASSURANCE_CERTIFICATIONS = {
    "Fairtrade",
    "Rainforest Alliance",
    "RSPO",
    "FSC",
    "PEFC",
    "ISO14001",
    "ISO22000",
    "HACCP",
}


class OnboardingService:
    def __init__(self) -> None:
        endpoint = os.getenv("AZURE_DOC_INTELLIGENCE_ENDPOINT") or os.getenv(
            "DOCUMENT_INTELLIGENCE_ENDPOINT"
        )
        key = os.getenv("AZURE_DOC_INTELLIGENCE_KEY") or os.getenv("DOCUMENT_INTELLIGENCE_KEY")
        self.data_dir = Path(__file__).resolve().parents[3] / "data"
        self.uploads_dir = Path(__file__).resolve().parents[3] / "uploads" / "onboarding" / "evidence"
        self.evidence_path = self.data_dir / "supplier_evidence_v2.csv"

        self.client = None
        if endpoint and key:
            self.client = DocumentAnalysisClient(
                endpoint=endpoint,
                credential=AzureKeyCredential(key),
            )

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

    def _score_esg_baseline(
        self,
        country: str | None,
        commodities: list[str],
        certifications: list[str],
        evidence_status: str | None = None,
    ) -> dict:
        scores = {
            "environmental": {
                "carbon": 48,
                "water": 48,
                "renewable": 50,
                "waste": 46,
                "land": 45,
                "deforestation": 45,
            },
            "social": {
                "labor": 46,
                "child": 44,
                "hours": 42,
                "wage": 44,
            },
            "governance": {
                "compliance": 45,
                "transparency": 48,
                "policy": 48,
                "reporting": 50,
            },
        }
        reasons: list[str] = ["Baseline generated from extracted country, commodity, certification, and evidence context."]
        commodity_set = {item for item in commodities if item}
        certification_set = {item for item in certifications if item}
        eudr_matches = sorted(commodity_set.intersection(EUDR_COMMODITIES))

        if eudr_matches:
            scores["environmental"]["land"] += 18
            scores["environmental"]["deforestation"] += 22
            scores["governance"]["compliance"] += 8
            scores["governance"]["transparency"] += 8
            reasons.append(f"EUDR commodity detected ({', '.join(eudr_matches)}), so land-use, deforestation, compliance, and transparency start higher.")

        if country in HIGH_LAND_RISK_COUNTRIES:
            scores["environmental"]["land"] += 8
            scores["environmental"]["deforestation"] += 10
            reasons.append(f"{country} has elevated land-use monitoring sensitivity for responsible sourcing onboarding.")

        if "Cocoa" in commodity_set:
            scores["social"]["labor"] += 6
            scores["social"]["child"] += 12
            scores["social"]["wage"] += 6
            reasons.append("Cocoa sourcing starts with stronger social due diligence sensitivity for labor, child-risk, and wage indicators.")

        if "Palm Oil" in commodity_set:
            scores["environmental"]["water"] += 8
            scores["environmental"]["waste"] += 6
            reasons.append("Palm oil sourcing increases water and waste baseline attention.")

        if "Coffee" in commodity_set:
            scores["environmental"]["water"] += 7
            scores["social"]["wage"] += 4
            reasons.append("Coffee sourcing adds water and wage-risk monitoring sensitivity.")

        if "Rubber" in commodity_set:
            scores["environmental"]["land"] += 6
            scores["social"]["hours"] += 5
            reasons.append("Rubber sourcing adds land conversion and working-hours monitoring sensitivity.")

        if certification_set.intersection(ASSURANCE_CERTIFICATIONS):
            scores["social"]["labor"] -= 8
            scores["social"]["child"] -= 8
            scores["governance"]["compliance"] -= 7
            scores["governance"]["reporting"] -= 5
            reasons.append(f"Recognized certification declared ({', '.join(sorted(certification_set.intersection(ASSURANCE_CERTIFICATIONS)))}) reduces initial social and governance risk, pending evidence verification.")

        if evidence_status == "Verified":
            scores["governance"]["compliance"] -= 8
            scores["governance"]["transparency"] -= 6
            scores["governance"]["reporting"] -= 6
            reasons.append("Verified evidence lowers governance uncertainty.")
        elif evidence_status in {"Expired", "Needs Review"}:
            scores["governance"]["compliance"] += 15
            scores["governance"]["transparency"] += 8
            scores["governance"]["reporting"] += 8
            reasons.append("Evidence requiring review raises governance and disclosure risk.")
        elif evidence_status in {"Evidence Received", "Baseline Only", "Baseline Created", "Intake Started", None, ""}:
            scores["governance"]["transparency"] += 4
            scores["governance"]["reporting"] += 4
            reasons.append("Scores remain conservative until uploaded evidence is verified.")

        for pillar_scores in scores.values():
            for key, value in pillar_scores.items():
                pillar_scores[key] = max(0, min(100, int(round(value))))

        flat_values = [value for pillar_scores in scores.values() for value in pillar_scores.values()]
        return {
            "scores": scores,
            "reasons": reasons,
            "confidence": "medium" if commodities and country else "low",
            "overall": int(round(sum(flat_values) / len(flat_values))),
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

    def _parse_optional_date(self, value: str | None) -> str | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            return None

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
                    "certificate_number": str(item.get("certificate_number", "")).strip(),
                    "issuing_body": str(item.get("issuing_body", "")).strip(),
                    "scope": str(item.get("scope", "")).strip(),
                    "evidence_id": self._parse_int(item.get("evidence_id")),
                    "validation_status": str(item.get("validation_status", "")).strip(),
                }
            )
        return normalized_rows

    def _ensure_evidence_store(self) -> pd.DataFrame:
        columns = [
            "evidence_id",
            "supplier_id",
            "temporary_supplier_key",
            "evidence_type",
            "linked_entity_type",
            "linked_entity_name",
            "file_name",
            "local_path",
            "upload_date",
            "document_status",
            "extracted_text_preview",
            "extracted_certificate_name",
            "extracted_certificate_number",
            "extracted_issuer",
            "extracted_issue_date",
            "extracted_expiry_date",
            "extracted_scope_site",
            "validation_status",
            "validation_notes",
            "review_status",
        ]
        if self.evidence_path.exists():
            evidence_df = pd.read_csv(self.evidence_path)
            for column in columns:
                if column not in evidence_df.columns:
                    evidence_df[column] = None
            return evidence_df[columns]
        evidence_df = pd.DataFrame(columns=columns)
        evidence_df.to_csv(self.evidence_path, index=False)
        return evidence_df

    def _save_evidence_file(self, file_name: str, file_bytes: bytes) -> Path:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", file_name).strip("_") or "evidence"
        target_path = self.uploads_dir / f"{uuid.uuid4().hex}_{safe_name}"
        with target_path.open("wb") as target:
            target.write(file_bytes)
        return target_path

    def _extract_certificate_fields(self, text: str) -> dict:
        date_pattern = r"(20\d{2}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]20\d{2})"
        dates = re.findall(date_pattern, text)
        normalized_dates = [self._normalize_detected_date(value) for value in dates]
        normalized_dates = [value for value in normalized_dates if value]
        certificate_number = None
        issuer = None
        scope_site = None
        scope_value = None
        site_value = None
        certificate_name = None
        commodity_name = None
        for line in text.splitlines():
            clean_line = line.strip()
            certificate_name_match = re.search(
                r"^(?:certificate name|certification name)\s*[:\-]\s*([A-Za-z0-9&.,\s-]{2,80})",
                clean_line,
                flags=re.IGNORECASE,
            )
            if certificate_name_match and certificate_name is None:
                certificate_name = certificate_name_match.group(1).strip()

            commodity_match = re.search(
                r"^(?:commodity|material|product)\s*[:\-]\s*([A-Za-z0-9&.,\s-]{2,80})",
                clean_line,
                flags=re.IGNORECASE,
            )
            if commodity_match and commodity_name is None:
                commodity_name = commodity_match.group(1).strip()

            cert_match = re.search(
                r"^(?:certificate|cert|registration)\s*(?:no\.?|number|#)?\s*[:\-]\s*([A-Z0-9][A-Z0-9\-\/]{4,})",
                clean_line,
                flags=re.IGNORECASE,
            )
            if cert_match and certificate_number is None:
                certificate_number = cert_match.group(1).strip()

            issuer_match = re.search(
                r"^(?:issued by|issuer|certification body)\s*[:\-]\s*([A-Za-z0-9&.,\s-]{3,80})",
                clean_line,
                flags=re.IGNORECASE,
            )
            if issuer_match and issuer is None:
                issuer = issuer_match.group(1).strip()

            scope_match = re.search(
                r"^(?:scope|operation|operations covered)\s*[:\-]\s*([A-Za-z0-9&.,;\/\s-]{3,140})",
                clean_line,
                flags=re.IGNORECASE,
            )
            if scope_match and scope_value is None:
                scope_value = scope_match.group(1).strip()

            site_match = re.search(
                r"^(?:site|facility)\s*[:\-]\s*([A-Za-z0-9&.,;\/\s-]{3,140})",
                clean_line,
                flags=re.IGNORECASE,
            )
            if site_match and site_value is None:
                site_value = site_match.group(1).strip()

        if issuer is None and certificate_name:
            issuer = f"{certificate_name} Certification Body"
        if scope_value and site_value:
            scope_site = f"{scope_value}; Site: {site_value}"
        elif scope_value:
            scope_site = scope_value
        elif site_value:
            scope_site = site_value
        if scope_site is None and commodity_name:
            scope_site = f"{commodity_name} supplier certification coverage"

        return {
            "certificate_name": certificate_name,
            "certificate_number": certificate_number,
            "issuer": issuer,
            "issue_date": normalized_dates[0] if normalized_dates else None,
            "expiry_date": normalized_dates[-1] if len(normalized_dates) > 1 else None,
            "scope_site": scope_site,
        }

    def _normalize_detected_date(self, value: str) -> str | None:
        value = value.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                continue
        return None

    def _validate_certificate_evidence(
        self,
        certification_name: str | None,
        extracted_text: str,
        extracted_fields: dict,
    ) -> tuple[str, str]:
        notes: list[str] = []
        status = "Verified"
        lowered_text = extracted_text.lower()
        if certification_name and certification_name.lower() not in lowered_text:
            status = "Needs Review"
            notes.append("Selected certification was not clearly found in the document text")
        if not extracted_fields.get("certificate_number"):
            status = "Needs Review"
            notes.append("Certificate number was not detected")
        expiry_date = extracted_fields.get("expiry_date")
        if not expiry_date:
            status = "Needs Review"
            notes.append("Expiry date was not detected")
        else:
            try:
                if date.fromisoformat(expiry_date) < date.today():
                    status = "Expired"
                    notes.append("Certificate appears expired")
            except ValueError:
                status = "Needs Review"
                notes.append("Expiry date could not be parsed")
        return status, "; ".join(notes) if notes else "Certificate evidence passed automated checks"

    def _validate_requirement_evidence(
        self,
        requirement_name: str | None,
        extracted_text: str,
    ) -> tuple[str, str]:
        lowered_text = extracted_text.lower()
        normalized_requirement = (requirement_name or "").lower()
        notes: list[str] = []
        review_signals = [
            "expired",
            "missing",
            "not provided",
            "not documented",
            "needs follow-up",
            "needs review",
            "open findings",
            "unresolved",
            "not available",
            "not verified",
        ]
        if not extracted_text.strip():
            return "Needs Review", "Document text could not be extracted for automated requirement validation"
        if any(signal in lowered_text for signal in review_signals):
            return "Needs Review", "Requirement evidence contains follow-up or gap signals"

        def has_any(keywords: list[str]) -> bool:
            return any(keyword in lowered_text for keyword in keywords)

        checks: list[tuple[str, bool]] = []
        if "plot" in normalized_requirement or "farm" in normalized_requirement:
            checks = [
                ("farm/plot identifier", has_any(["plot id", "plot identifier", "farm id", "farm identifier", "traceability id", "plots covered", "farm / plot"])),
                ("supplier or farm owner reference", has_any(["supplier:", "farmer", "farm owner", "producer"])),
                ("commodity reference", has_any(["cocoa", "coffee", "palm oil", "rubber", "wood", "soya"])),
            ]
        elif "geolocation" in normalized_requirement or "polygon" in normalized_requirement:
            coordinate_pattern = re.compile(r"-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}")
            checks = [
                ("GPS coordinate or polygon geometry", bool(coordinate_pattern.search(extracted_text)) or has_any(["polygon", "geojson", "gps", "latitude", "longitude"])),
                ("farm/plot linkage", has_any(["plot id", "farm id", "farm boundary", "polygon id", "declared plots", "polygon reference", "coverage"])),
            ]
        elif "deforestation" in normalized_requirement:
            checks = [
                ("deforestation-free declaration", has_any(["deforestation-free", "deforestation free"])),
                ("cutoff or assessment date", has_any(["cutoff", "cut-off", "assessment date", "declaration date"])),
                ("commodity or sourcing scope", has_any(["cocoa", "coffee", "palm oil", "rubber", "wood", "soya", "scope"])),
            ]
        elif "labor" in normalized_requirement or "child" in normalized_requirement:
            checks = [
                ("labor questionnaire reference", has_any(["labor", "labour", "worker", "workforce"])),
                ("child-risk response", has_any(["child labor", "child labour", "child-risk", "child risk"])),
                ("completion or attestation signal", has_any(["complete", "completed", "attestation", "signed", "no open findings", "none reported", "completion date"])),
            ]
        elif "chain" in normalized_requirement or "custody" in normalized_requirement:
            checks = [
                ("chain-of-custody reference", has_any(["chain of custody", "chain-of-custody", "custody"])),
                ("lot or batch identifier", has_any(["lot id", "lot-", "lots:", "inbound lots", "outbound lot", "batch id", "transaction id", "shipment id"])),
                ("source linkage", has_any(["source farm", "origin plot", "inbound", "outbound", "traceability link"])),
            ]

        missing = [label for label, passed in checks if not passed]
        if missing:
            notes.extend(f"Missing {label}" for label in missing)
            return "Needs Review", "; ".join(notes)

        if checks:
            return "Complete", f"{requirement_name or 'Requirement'} evidence passed document-specific checks"

        return "Complete", f"{requirement_name or 'Requirement'} evidence uploaded and extracted"

    def upload_evidence(
        self,
        file_name: str,
        file_bytes: bytes,
        evidence_type: str | None,
        linked_entity_type: str | None,
        linked_entity_name: str | None,
        supplier_id: str | None,
        temporary_supplier_key: str | None,
    ) -> dict:
        if not file_bytes:
            raise Exception("Uploaded evidence file is empty")

        saved_path = self._save_evidence_file(file_name, file_bytes)
        try:
            extracted_text = self.extract_text(file_bytes)
        except Exception:
            extracted_text = ""
        extracted_fields = self._extract_certificate_fields(extracted_text)
        if (linked_entity_type or "").lower() == "onboarding requirement":
            validation_status, validation_notes = self._validate_requirement_evidence(
                linked_entity_name,
                extracted_text,
            )
        else:
            validation_status, validation_notes = self._validate_certificate_evidence(
                linked_entity_name,
                extracted_text,
                extracted_fields,
            )

        evidence_df = self._ensure_evidence_store()
        evidence_id = self._get_next_id(evidence_df, "evidence_id")
        row = {
            "evidence_id": evidence_id,
            "supplier_id": self._parse_int(supplier_id),
            "temporary_supplier_key": temporary_supplier_key,
            "evidence_type": evidence_type or "Certification",
            "linked_entity_type": linked_entity_type or "Certification",
            "linked_entity_name": linked_entity_name,
            "file_name": file_name,
            "local_path": str(saved_path),
            "upload_date": date.today().isoformat(),
            "document_status": "Extracted" if extracted_text else "Uploaded",
            "extracted_text_preview": extracted_text[:500],
            "extracted_certificate_name": extracted_fields.get("certificate_name") or linked_entity_name,
            "extracted_certificate_number": extracted_fields.get("certificate_number"),
            "extracted_issuer": extracted_fields.get("issuer"),
            "extracted_issue_date": extracted_fields.get("issue_date"),
            "extracted_expiry_date": extracted_fields.get("expiry_date"),
            "extracted_scope_site": extracted_fields.get("scope_site"),
            "validation_status": validation_status,
            "validation_notes": validation_notes,
            "review_status": "Needs Review" if validation_status == "Needs Review" else validation_status,
        }
        evidence_df = pd.concat([evidence_df, pd.DataFrame([row])], ignore_index=True)
        evidence_df.to_csv(self.evidence_path, index=False)
        return row

    def _append_default_row(self, df: pd.DataFrame, supplier_id: int) -> pd.DataFrame:
        new_row: dict[str, object] = {"supplier_id": supplier_id}
        for column in df.columns:
            if column == "supplier_id":
                continue
            numeric_series = pd.to_numeric(df[column], errors="coerce")
            numeric_mean = numeric_series.mean(skipna=True)
            new_row[column] = None if pd.isna(numeric_mean) else float(numeric_mean)
        return pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

    def _apply_esg_baseline(self, df: pd.DataFrame, supplier_id: int, values: dict) -> pd.DataFrame:
        row = {column: None for column in df.columns}
        row["supplier_id"] = supplier_id
        for column in df.columns:
            if column == "supplier_id":
                continue
            baseline_value = self._parse_float(values.get(column))
            if baseline_value is not None:
                row[column] = max(0.0, min(1.0, baseline_value / 100.0))
                continue
            numeric_series = pd.to_numeric(df[column], errors="coerce")
            numeric_mean = numeric_series.mean(skipna=True)
            row[column] = None if pd.isna(numeric_mean) else float(numeric_mean)
        return pd.concat([df, pd.DataFrame([row])], ignore_index=True)

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
        if not issues:
            return None

        prompt = f"""
You are helping with AI-assisted supplier onboarding remediation.

{get_prompt_policy_block("onboarding")}

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
            response = generate_ai_text(
                AiTextRequest(
                    feature="onboarding",
                    prompt=prompt,
                    user_input=raw_text[:3000] or json.dumps(data, default=str),
                    context={"extracted_fields": data, "validation": validation},
                    response_format="json",
                )
            )
            text = self._extract_json_block(response.text.strip())
            result = json.loads(text)
            if not isinstance(result, dict):
                return None
            validated = validate_onboarding_assistance(result)
            if validated["confidence"] == "low":
                add_review_item(
                    feature="onboarding",
                    reason="low_confidence_ai_output",
                    prompt_hash=response.prompt_hash,
                    payload={
                        "supplier_name": data.get("supplier_name"),
                        "errors": validation.get("errors", []),
                        "warnings": validation.get("warnings", []),
                    },
                )
            return validated
        except (GuardrailViolation, AiGatewayError, json.JSONDecodeError, ValueError):
            return None

    def generate_onboarding_decision(self, payload: dict) -> dict:
        fallback = payload.get("deterministic_decision") or {}
        prompt = f"""
You are an AI-assisted responsible sourcing onboarding decision engine.

{get_prompt_policy_block("onboarding")}

Use the supplied structured onboarding data to recommend one business status:
- Draft
- Evidence Requested
- Evidence Under Review
- Ready for Approval
- Approved
- Approved With Conditions
- Rejected

Return only valid JSON with this exact shape:
{{
  "recommendation": "Evidence Requested",
  "confidence": "High|Medium|Low",
  "reasons": ["short reason"],
  "nextActions": ["short action"],
  "source": "llm"
}}

Decision rules:
- Do not recommend Approved unless every required evidence item is complete and no document is expired or needs review.
- Use Evidence Requested when required evidence is missing.
- Use Evidence Under Review when any evidence is expired, mismatched, or needs review.
- Use Approved With Conditions only when risk remains but no hard evidence blocker exists.
- Keep reasons grounded in the provided data.

Structured onboarding data:
{json.dumps(payload, default=str)[:6000]}
"""
        try:
            response = generate_ai_text(
                AiTextRequest(
                    feature="onboarding",
                    prompt=prompt,
                    user_input=json.dumps(payload, default=str)[:3000],
                    context={"onboarding_decision_payload": payload},
                    response_format="json",
                )
            )
            parsed = json.loads(self._extract_json_block(response.text.strip()))
            recommendation = str(parsed.get("recommendation") or fallback.get("recommendation") or "Draft")
            confidence = str(parsed.get("confidence") or fallback.get("confidence") or "Medium")
            reasons = parsed.get("reasons") if isinstance(parsed.get("reasons"), list) else fallback.get("reasons", [])
            next_actions = (
                parsed.get("nextActions")
                if isinstance(parsed.get("nextActions"), list)
                else fallback.get("nextActions", [])
            )
            return {
                "recommendation": recommendation,
                "confidence": confidence,
                "reasons": [str(item) for item in reasons][:5],
                "nextActions": [str(item) for item in next_actions][:5],
                "source": "llm",
                "provider": response.provider,
                "model": response.model,
            }
        except (GuardrailViolation, AiGatewayError, json.JSONDecodeError, ValueError):
            return {
                "recommendation": fallback.get("recommendation", "Draft"),
                "confidence": fallback.get("confidence", "Low"),
                "reasons": fallback.get("reasons", ["LLM decision unavailable; deterministic fallback used."]),
                "nextActions": fallback.get("nextActions", []),
                "source": "deterministic_fallback",
            }

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
            for column in [
                "supplier_role",
                "plot_traceability_available",
                "geolocation_evidence_available",
                "chain_of_custody_available",
                "deforestation_declaration_available",
                "labor_questionnaire_status",
                "traceability_notes",
                "onboarding_requirements_json",
                "approval_status",
                "reviewer_name",
                "approval_decision",
                "approval_decision_date",
                "approval_conditions",
                "approval_blockers",
            ]:
                if column not in suppliers_df.columns:
                    suppliers_df[column] = None
            supplier_commodity_map_df = pd.read_csv(supplier_commodity_map_path)
            supplier_certifications_df = pd.read_csv(supplier_certifications_path)
            for column in [
                "certificate_number",
                "issuing_body",
                "scope",
                "evidence_id",
                "validation_status",
            ]:
                if column not in supplier_certifications_df.columns:
                    supplier_certifications_df[column] = None
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
                new_supplier_row["status"] = data.get("status") or "Pending"
            for column in [
                "esg_baseline_date",
                "evidence_status",
                "eudr_relevant",
                "traceability_required",
                "site_region",
                "supplier_role",
                "plot_traceability_available",
                "geolocation_evidence_available",
                "chain_of_custody_available",
                "deforestation_declaration_available",
                "labor_questionnaire_status",
                "traceability_notes",
                "onboarding_requirements_json",
                "approval_status",
                "reviewer_name",
                "approval_decision",
                "approval_decision_date",
                "approval_conditions",
                "approval_blockers",
            ]:
                if column in new_supplier_row:
                    new_supplier_row[column] = data.get(column)

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
                        "certificate_number": metadata.get("certificate_number") or None,
                        "issuing_body": metadata.get("issuing_body") or None,
                        "scope": metadata.get("scope") or None,
                        "evidence_id": metadata.get("evidence_id"),
                        "validation_status": metadata.get("validation_status") or status_value,
                    }
                )
                next_certification_id += 1

            if certification_rows:
                supplier_certifications_df = pd.concat(
                    [supplier_certifications_df, pd.DataFrame(certification_rows)],
                    ignore_index=True,
                )

            supplier_features_df = self._append_default_row(supplier_features_df, supplier_id)
            esg_environmental_df = self._apply_esg_baseline(
                esg_environmental_df,
                supplier_id,
                data.get("esg_environmental", {}),
            )
            esg_social_df = self._apply_esg_baseline(
                esg_social_df,
                supplier_id,
                data.get("esg_social", {}),
            )
            esg_governance_df = self._apply_esg_baseline(
                esg_governance_df,
                supplier_id,
                data.get("esg_governance", {}),
            )
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
        esg_baseline_suggestion = self._score_esg_baseline(
            mapped_data.get("country"),
            mapped_data.get("commodities", []),
            mapped_data.get("certifications", []),
            "Baseline Created",
        )

        return {
            "message": "Upload successful",
            "supplier_id": None,
            "raw_text": raw_text[:1000],
            "supplier_name": mapped_data["supplier_name"],
            "country": mapped_data["country"],
            "commodities": mapped_data["commodities"],
            "certifications": mapped_data["certifications"],
            "esg": mapped_data["esg"],
            "esg_baseline_suggestion": esg_baseline_suggestion,
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
        esg_baseline_date: str | None,
        evidence_status: str | None,
        eudr_relevant: str | None,
        traceability_required: str | None,
        site_region: str | None,
        supplier_role: str | None,
        plot_traceability_available: str | None,
        geolocation_evidence_available: str | None,
        chain_of_custody_available: str | None,
        deforestation_declaration_available: str | None,
        labor_questionnaire_status: str | None,
        traceability_notes: str | None,
        onboarding_requirements_json: str | None,
        approval_status: str | None,
        reviewer_name: str | None,
        approval_decision: str | None,
        approval_decision_date: str | None,
        approval_conditions: str | None,
        approval_blockers: str | None,
        carbon: str | None,
        water: str | None,
        renewable: str | None,
        waste: str | None,
        land: str | None,
        deforestation: str | None,
        labor: str | None,
        child: str | None,
        hours: str | None,
        wage: str | None,
        compliance: str | None,
        transparency: str | None,
        policy: str | None,
        reporting: str | None,
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
            "esg_baseline_date": self._parse_date(esg_baseline_date, date.today()),
            "evidence_status": evidence_status.strip() if evidence_status else "Intake Started",
            "eudr_relevant": eudr_relevant.strip() if eudr_relevant else "No",
            "traceability_required": traceability_required.strip() if traceability_required else "No",
            "site_region": site_region.strip() if site_region else country,
            "supplier_role": supplier_role.strip() if supplier_role else "Producer",
            "plot_traceability_available": plot_traceability_available.strip() if plot_traceability_available else "No",
            "geolocation_evidence_available": geolocation_evidence_available.strip() if geolocation_evidence_available else "No",
            "chain_of_custody_available": chain_of_custody_available.strip() if chain_of_custody_available else "No",
            "deforestation_declaration_available": deforestation_declaration_available.strip() if deforestation_declaration_available else "No",
            "labor_questionnaire_status": labor_questionnaire_status.strip() if labor_questionnaire_status else "Requested",
            "traceability_notes": traceability_notes.strip() if traceability_notes else None,
            "onboarding_requirements_json": onboarding_requirements_json.strip() if onboarding_requirements_json else None,
            "approval_status": approval_status.strip() if approval_status else "Draft",
            "reviewer_name": reviewer_name.strip() if reviewer_name else None,
            "approval_decision": approval_decision.strip() if approval_decision else "Pending",
            "approval_decision_date": self._parse_optional_date(approval_decision_date),
            "approval_conditions": approval_conditions.strip() if approval_conditions else None,
            "approval_blockers": approval_blockers.strip() if approval_blockers else None,
            "commodities": self._normalize_list_input(commodities),
            "certifications": self._normalize_list_input(certifications),
            "certification_rows": self._normalize_certification_rows(certification_rows),
            "esg_environmental": {
                "carbon": carbon,
                "water": water,
                "renewable": renewable,
                "waste": waste,
                "land": land,
                "deforestation": deforestation,
            },
            "esg_social": {
                "labor": labor,
                "child": child,
                "hours": hours,
                "wage": wage,
            },
            "esg_governance": {
                "compliance": compliance,
                "transparency": transparency,
                "policy": policy,
                "reporting": reporting,
            },
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
            message = "Supplier onboarding submitted"

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
            "esg_baseline_date": mapped_data["esg_baseline_date"],
            "evidence_status": mapped_data["evidence_status"],
            "eudr_relevant": mapped_data["eudr_relevant"],
            "traceability_required": mapped_data["traceability_required"],
            "site_region": mapped_data["site_region"],
            "supplier_role": mapped_data["supplier_role"],
            "plot_traceability_available": mapped_data["plot_traceability_available"],
            "geolocation_evidence_available": mapped_data["geolocation_evidence_available"],
            "chain_of_custody_available": mapped_data["chain_of_custody_available"],
            "deforestation_declaration_available": mapped_data["deforestation_declaration_available"],
            "labor_questionnaire_status": mapped_data["labor_questionnaire_status"],
            "traceability_notes": mapped_data["traceability_notes"],
            "onboarding_requirements_json": mapped_data["onboarding_requirements_json"],
            "approval_status": mapped_data["approval_status"],
            "reviewer_name": mapped_data["reviewer_name"],
            "approval_decision": mapped_data["approval_decision"],
            "approval_decision_date": mapped_data["approval_decision_date"],
            "approval_conditions": mapped_data["approval_conditions"],
            "approval_blockers": mapped_data["approval_blockers"],
            "commodities": mapped_data["commodities"],
            "certifications": mapped_data["certifications"],
            "certification_rows": mapped_data["certification_rows"],
            "esg": mapped_data["esg"],
            "validation": validation,
            "ai_assistance": ai_assistance,
        }

    def activate_supplier(self, supplier_id: int) -> dict:
        suppliers_path = self.data_dir / "suppliers_v2.csv"
        if not suppliers_path.exists():
            raise Exception("Supplier data file was not found")

        suppliers_df = pd.read_csv(suppliers_path)
        if "supplier_id" not in suppliers_df.columns:
            raise Exception("Supplier data is missing supplier_id")

        supplier_ids = pd.to_numeric(suppliers_df["supplier_id"], errors="coerce")
        matches = suppliers_df.index[supplier_ids == supplier_id].tolist()
        if not matches:
            raise Exception(f"Supplier {supplier_id} was not found")

        row_index = matches[0]
        current_status = str(suppliers_df.at[row_index, "status"] or "").strip()
        if current_status != "Pending":
            raise Exception("Only Pending suppliers can be activated from onboarding")

        blockers = ""
        if "approval_blockers" in suppliers_df.columns:
            blockers = str(suppliers_df.at[row_index, "approval_blockers"] or "").strip()
        if blockers:
            raise Exception("Supplier still has approval blockers. Resolve blockers before activation")

        suppliers_df.at[row_index, "status"] = "Active"
        if "approval_status" in suppliers_df.columns:
            suppliers_df.at[row_index, "approval_status"] = "Approved"
        if "approval_decision" in suppliers_df.columns:
            suppliers_df.at[row_index, "approval_decision"] = "Approved"
        if "approval_decision_date" in suppliers_df.columns:
            suppliers_df.at[row_index, "approval_decision_date"] = date.today().isoformat()
        if "evidence_status" in suppliers_df.columns:
            suppliers_df.at[row_index, "evidence_status"] = "Verified"

        suppliers_df.to_csv(suppliers_path, index=False)

        return {
            "message": "Supplier approved and activated",
            "supplier_id": supplier_id,
            "status": "Active",
            "approval_status": "Approved",
            "approval_decision_date": date.today().isoformat(),
        }

    def revalidate_active_supplier(self, supplier_id: int, outcome: str, notes: str | None = None) -> dict:
        suppliers_path = self.data_dir / "suppliers_v2.csv"
        if not suppliers_path.exists():
            raise Exception("Supplier data file was not found")

        allowed_outcomes = {
            "Revalidation Requested": "Evidence Requested",
            "Evidence Received": "Evidence Received",
            "Needs Review": "Needs Review",
            "Revalidated": "Verified",
        }
        if outcome not in allowed_outcomes:
            raise Exception("Unsupported revalidation outcome")

        suppliers_df = pd.read_csv(suppliers_path)
        supplier_ids = pd.to_numeric(suppliers_df["supplier_id"], errors="coerce")
        matches = suppliers_df.index[supplier_ids == supplier_id].tolist()
        if not matches:
            raise Exception(f"Supplier {supplier_id} was not found")

        row_index = matches[0]
        current_status = str(suppliers_df.at[row_index, "status"] or "").strip()
        if current_status != "Active":
            raise Exception("Only Active suppliers can use the revalidation workflow")

        evidence_status = allowed_outcomes[outcome]
        suppliers_df.at[row_index, "evidence_status"] = evidence_status
        if "approval_status" in suppliers_df.columns:
            suppliers_df.at[row_index, "approval_status"] = outcome
        if "approval_decision" in suppliers_df.columns and outcome == "Revalidated":
            suppliers_df.at[row_index, "approval_decision"] = "Revalidated"
        if "approval_decision_date" in suppliers_df.columns and outcome == "Revalidated":
            suppliers_df.at[row_index, "approval_decision_date"] = date.today().isoformat()
        if "esg_baseline_date" in suppliers_df.columns and outcome == "Revalidated":
            suppliers_df.at[row_index, "esg_baseline_date"] = date.today().isoformat()
        if "traceability_notes" in suppliers_df.columns and notes:
            existing_notes = str(suppliers_df.at[row_index, "traceability_notes"] or "").strip()
            note_entry = f"{date.today().isoformat()} revalidation: {notes.strip()}"
            suppliers_df.at[row_index, "traceability_notes"] = (
                f"{existing_notes}\n{note_entry}" if existing_notes else note_entry
            )
        if "approval_blockers" in suppliers_df.columns:
            suppliers_df.at[row_index, "approval_blockers"] = (
                notes.strip() if outcome == "Needs Review" and notes else ""
            )

        suppliers_df.to_csv(suppliers_path, index=False)

        return {
            "message": "Supplier revalidation updated",
            "supplier_id": supplier_id,
            "status": "Active",
            "approval_status": outcome,
            "evidence_status": evidence_status,
            "revalidation_date": date.today().isoformat(),
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
