import pandas as pd

from ..core.exceptions import AppError
from ..core.logging import get_logger
from .dataset_service import DatasetService

logger = get_logger(__name__)
RISK_REFERENCE_DATE = pd.Timestamp("2026-04-27")


class RiskService:
    def __init__(self) -> None:
        self.dataset_service = DatasetService()

    def get_risk_overview(self) -> dict:
        risk_frame = self._build_supplier_risk_frame()
        high_risk = risk_frame[risk_frame["overall_risk_level"] == "High"]
        medium_risk = risk_frame[risk_frame["overall_risk_level"] == "Medium"]
        low_risk = risk_frame[risk_frame["overall_risk_level"] == "Low"]

        return {
            "highRiskCount": int(len(high_risk)),
            "mediumRiskCount": int(len(medium_risk)),
            "lowRiskCount": int(len(low_risk)),
            "avgRiskScore": round(float(risk_frame["overall_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
            "avgOperationalRisk": round(float(risk_frame["operational_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
            "avgEsgRisk": round(float(risk_frame["esg_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
            "avgOverallRisk": round(float(risk_frame["overall_risk_score"].mean()), 2)
            if not risk_frame.empty
            else 0.0,
        }

    def get_risk_distribution(self, bins: int = 7) -> list[dict]:
        risk_frame = self._build_supplier_risk_frame()
        if risk_frame.empty:
            return []

        scores = pd.to_numeric(risk_frame["overall_risk_score"], errors="coerce").dropna()
        if scores.empty:
            return []

        value_counts = pd.cut(scores, bins=max(1, bins), include_lowest=True).value_counts(
            sort=False
        )

        histogram = []
        for interval, count in value_counts.items():
            histogram.append(
                {
                    "label": f"{float(interval.left):.1f}-{float(interval.right):.1f}",
                    "start": round(float(interval.left), 1),
                    "end": round(float(interval.right), 1),
                    "count": int(count),
                }
            )

        return histogram

    def get_risk_segmentation(self) -> list[dict]:
        risk_frame = self._build_supplier_risk_frame()
        if risk_frame.empty:
            return []

        counts = risk_frame["overall_risk_level"].value_counts()
        return [
            {"riskLevel": "High", "supplierCount": int(counts.get("High", 0))},
            {"riskLevel": "Medium", "supplierCount": int(counts.get("Medium", 0))},
            {"riskLevel": "Low", "supplierCount": int(counts.get("Low", 0))},
        ]

    def get_top_risk_suppliers(self, limit: int = 10) -> list[dict]:
        risk_frame = self._build_supplier_risk_frame()
        if risk_frame.empty:
            return []

        top_risk = risk_frame.sort_values("overall_risk_score", ascending=False).head(limit)
        return [
            {
                "supplierId": int(row["supplier_id"]),
                "supplierName": row.get("supplier_name"),
                "country": row.get("country"),
                "category": row.get("category"),
                "tier": row.get("tier"),
                "avgDelay": round(float(row.get("avg_delay", 0.0) or 0.0), 2),
                "avgDefect": round(float(row.get("avg_defect", 0.0) or 0.0), 4),
                "avgCostVariance": round(float(row.get("avg_cost_variance", 0.0) or 0.0), 2),
                "operationalRiskScore": round(float(row["operational_risk_score"]), 2),
                "esgRiskScore": round(float(row["esg_risk_score"]), 2),
                "overallRiskScore": round(float(row["overall_risk_score"]), 2),
                "riskScore": round(float(row["overall_risk_score"]), 2),
                "operationalRiskLevel": row["operational_risk_level"],
                "esgRiskLevel": row["esg_risk_level"],
                "riskLevel": row["overall_risk_level"],
            }
            for _, row in top_risk.iterrows()
        ]

    def run_due_diligence(self, supplier_id: int) -> dict:
        suppliers = self.dataset_service.load_suppliers_frame()
        esg = self.dataset_service.load_esg_frame()
        risk_frame = self._build_supplier_risk_frame()

        supplier_rows = risk_frame[risk_frame["supplier_id"] == supplier_id]
        if supplier_rows.empty:
            raise AppError("Supplier not found in risk dataset", status_code=404)

        supplier_row = supplier_rows.iloc[0]
        supplier_name = str(supplier_row["supplier_name"])

        try:
            try:
                from backend.due_diligence_agent import run_due_diligence
            except ImportError:
                from due_diligence_agent import run_due_diligence

            result = run_due_diligence(supplier_name, risk_frame, esg, suppliers)
        except Exception as exc:
            logger.exception("Due diligence evaluation failed", exc_info=exc)
            raise AppError("Unable to run due diligence analysis", status_code=500) from exc

        return {
            "supplier": result["supplier"],
            "opRisk": result["op_risk"],
            "opRiskScore": round(float(supplier_row["operational_risk_score"]), 2),
            "esgRisk": result["esg_risk"],
            "esgRiskScore": round(float(supplier_row["esg_risk_score"]), 2),
            "overall": result["overall"],
            "overallRiskScore": round(float(supplier_row["overall_risk_score"]), 2),
            "issues": result["issues"],
            "aiSummary": result["ai_summary"],
        }

    def _build_supplier_risk_frame(self) -> pd.DataFrame:
        suppliers = self.dataset_service.load_suppliers_frame()
        if suppliers.empty:
            return suppliers

        transactions = self.dataset_service.load_full_transactions()
        esg = self.dataset_service.load_esg_frame()
        settings = self.dataset_service.settings
        audits = self.dataset_service.load_optional_csv(settings.audits_file, "audits")
        alerts = self.dataset_service.load_optional_csv(settings.alerts_file, "alerts")
        supplier_certs = self.dataset_service.load_optional_csv(
            settings.supplier_certifications_file,
            "supplier_certifications",
        )
        commodities = self.dataset_service.load_optional_csv(settings.commodities_file, "commodities")
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )
        supplier_features = self.dataset_service.load_optional_csv(
            settings.supplier_features_file,
            "supplier_features",
        )

        transaction_metrics = self._build_transaction_metrics(transactions)
        audit_metrics = self._build_audit_metrics(audits)
        alert_metrics = self._build_alert_metrics(alerts)
        certification_metrics = self._build_certification_metrics(supplier_certs)
        commodity_metrics = self._build_commodity_metrics(supplier_commodity_map, commodities)
        supplier_metrics = self._build_supplier_metrics(suppliers)
        esg_metrics = self._build_esg_metrics(esg)

        risk_frame = suppliers.merge(transaction_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(audit_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(alert_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(certification_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(commodity_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(supplier_metrics, on="supplier_id", how="left")
        risk_frame = risk_frame.merge(esg_metrics, on="supplier_id", how="left")

        if not supplier_features.empty and "supplier_id" in supplier_features.columns:
            fallback_columns = [
                column
                for column in ["avg_delay", "avg_defect"]
                if column in supplier_features.columns and column not in risk_frame.columns
            ]
            if fallback_columns:
                risk_frame = risk_frame.merge(
                    supplier_features[["supplier_id", *fallback_columns]],
                    on="supplier_id",
                    how="left",
                )

        for column in [
            "avg_delay",
            "avg_defect",
            "avg_cost_variance",
            "delay_volatility",
            "defect_volatility",
            "recent_delay_risk",
            "recent_defect_risk",
            "trend_delay_risk",
            "trend_defect_risk",
            "repeat_delay_risk",
            "repeat_defect_risk",
            "dependency_score",
            "criticality_score",
            "audit_non_compliance_mean",
            "audit_score_inverse",
            "recent_audit_non_compliance",
            "recent_audit_score_inverse",
            "audit_trend_risk",
            "repeat_audit_issue_risk",
            "open_alert_severity",
            "open_alert_count",
            "critical_open_alert_risk",
            "certification_gap_score",
            "certification_recency_risk",
            "commodity_exposure_risk",
            "country_risk_score",
            "environmental_risk_score",
            "social_risk_score",
            "governance_risk_score",
        ]:
            if column not in risk_frame.columns:
                risk_frame[column] = 0.0

        neutral_defaults = {
            "avg_delay": 50.0,
            "avg_defect": 50.0,
            "avg_cost_variance": 50.0,
            "delay_volatility": 50.0,
            "defect_volatility": 50.0,
            "recent_delay_risk": 50.0,
            "recent_defect_risk": 50.0,
            "trend_delay_risk": 50.0,
            "trend_defect_risk": 50.0,
            "repeat_delay_risk": 50.0,
            "repeat_defect_risk": 50.0,
            "dependency_score": 50.0,
            "criticality_score": 50.0,
            "audit_non_compliance_mean": 50.0,
            "audit_score_inverse": 50.0,
            "recent_audit_non_compliance": 50.0,
            "recent_audit_score_inverse": 50.0,
            "audit_trend_risk": 50.0,
            "repeat_audit_issue_risk": 50.0,
            "open_alert_count": 0.0,
            "open_alert_severity": 0.0,
            "critical_open_alert_risk": 0.0,
            "certification_gap_score": 70.0,
            "certification_recency_risk": 50.0,
            "commodity_exposure_risk": 50.0,
            "country_risk_score": 50.0,
            "environmental_risk_score": 50.0,
            "social_risk_score": 50.0,
            "governance_risk_score": 50.0,
        }
        for column, default_value in neutral_defaults.items():
            risk_frame[column] = pd.to_numeric(risk_frame[column], errors="coerce").fillna(default_value)

        risk_frame["operational_risk_score"] = (
            0.09 * risk_frame["avg_delay"]
            + 0.07 * risk_frame["delay_volatility"]
            + 0.08 * risk_frame["avg_defect"]
            + 0.05 * risk_frame["defect_volatility"]
            + 0.05 * risk_frame["avg_cost_variance"]
            + 0.07 * risk_frame["recent_delay_risk"]
            + 0.06 * risk_frame["recent_defect_risk"]
            + 0.05 * risk_frame["trend_delay_risk"]
            + 0.04 * risk_frame["trend_defect_risk"]
            + 0.03 * risk_frame["repeat_delay_risk"]
            + 0.03 * risk_frame["repeat_defect_risk"]
            + 0.08 * risk_frame["dependency_score"]
            + 0.08 * risk_frame["criticality_score"]
            + 0.08 * risk_frame["audit_non_compliance_mean"]
            + 0.04 * risk_frame["audit_score_inverse"]
            + 0.06 * risk_frame["recent_audit_non_compliance"]
            + 0.04 * risk_frame["recent_audit_score_inverse"]
            + 0.04 * risk_frame["audit_trend_risk"]
            + 0.03 * risk_frame["repeat_audit_issue_risk"]
            + 0.03 * risk_frame["open_alert_count"]
            + 0.05 * risk_frame["open_alert_severity"]
            + 0.04 * risk_frame["critical_open_alert_risk"]
            + 0.05 * risk_frame["certification_gap_score"]
            + 0.03 * risk_frame["certification_recency_risk"]
            + 0.05 * risk_frame["commodity_exposure_risk"]
            + 0.04 * risk_frame["country_risk_score"]
        ).round(2)

        risk_frame["esg_risk_score"] = (
            0.40 * risk_frame["environmental_risk_score"]
            + 0.35 * risk_frame["social_risk_score"]
            + 0.25 * risk_frame["governance_risk_score"]
        ).round(2)

        dual_pressure = (
            ((risk_frame["operational_risk_score"] + risk_frame["esg_risk_score"]) / 2) * 0.05
        ).round(2)
        imbalance_pressure = (
            (
                (risk_frame["operational_risk_score"] - risk_frame["esg_risk_score"]).abs() / 100
            )
            * risk_frame[["operational_risk_score", "esg_risk_score"]].max(axis=1)
            * 0.30
        ).round(2)
        risk_frame["overall_risk_score"] = (
            0.58 * risk_frame["operational_risk_score"]
            + 0.37 * risk_frame["esg_risk_score"]
            + dual_pressure
            + imbalance_pressure
        ).clip(0, 100).round(2)
        risk_frame["risk_score"] = risk_frame["overall_risk_score"]

        risk_frame["operational_risk_level"] = risk_frame["operational_risk_score"].apply(
            self._classify_risk_level
        )
        risk_frame["esg_risk_level"] = risk_frame["esg_risk_score"].apply(self._classify_risk_level)
        risk_frame["overall_risk_level"] = risk_frame["overall_risk_score"].apply(
            self._classify_risk_level
        )

        return risk_frame.where(pd.notna(risk_frame), None)

    def _build_transaction_metrics(self, transactions: pd.DataFrame) -> pd.DataFrame:
        if transactions.empty or "supplier_id" not in transactions.columns:
            return pd.DataFrame(columns=["supplier_id"])

        working = transactions.copy()
        working["date"] = pd.to_datetime(working.get("date"), errors="coerce")
        recent_cutoff = RISK_REFERENCE_DATE - pd.Timedelta(days=180)
        recent_transactions = working[working["date"].ge(recent_cutoff)].copy()
        if recent_transactions.empty:
            recent_transactions = working.copy()

        transaction_metrics = transactions.groupby("supplier_id").agg(
            avg_delay=("delivery_delay_days", "mean"),
            delay_volatility=("delivery_delay_days", "std"),
            avg_defect=("defect_rate", "mean"),
            defect_volatility=("defect_rate", "std"),
            avg_cost_variance=("cost_variance", lambda values: values.abs().mean()),
        ).reset_index()

        recent_metrics = recent_transactions.groupby("supplier_id").agg(
            recent_avg_delay=("delivery_delay_days", "mean"),
            recent_avg_defect=("defect_rate", "mean"),
            repeat_delay_incidents=("delivery_delay_days", lambda values: (values > 7).sum()),
            repeat_defect_incidents=("defect_rate", lambda values: (values > 0.05).sum()),
        ).reset_index()
        transaction_metrics = transaction_metrics.merge(recent_metrics, on="supplier_id", how="left")

        transaction_metrics["delay_trend_raw"] = (
            transaction_metrics["recent_avg_delay"] - transaction_metrics["avg_delay"]
        )
        transaction_metrics["defect_trend_raw"] = (
            transaction_metrics["recent_avg_defect"] - transaction_metrics["avg_defect"]
        )

        for column in [
            "avg_delay",
            "delay_volatility",
            "avg_defect",
            "defect_volatility",
            "avg_cost_variance",
        ]:
            transaction_metrics[column] = self._relative_risk_score(transaction_metrics[column])

        transaction_metrics["recent_delay_risk"] = self._relative_risk_score(
            transaction_metrics["recent_avg_delay"]
        )
        transaction_metrics["recent_defect_risk"] = self._relative_risk_score(
            transaction_metrics["recent_avg_defect"]
        )
        transaction_metrics["trend_delay_risk"] = self._relative_risk_score(
            transaction_metrics["delay_trend_raw"].clip(lower=0)
        )
        transaction_metrics["trend_defect_risk"] = self._relative_risk_score(
            transaction_metrics["defect_trend_raw"].clip(lower=0)
        )
        transaction_metrics["repeat_delay_risk"] = self._relative_risk_score(
            transaction_metrics["repeat_delay_incidents"]
        )
        transaction_metrics["repeat_defect_risk"] = self._relative_risk_score(
            transaction_metrics["repeat_defect_incidents"]
        )

        return transaction_metrics

    def _build_audit_metrics(self, audits: pd.DataFrame) -> pd.DataFrame:
        if audits.empty or "supplier_id" not in audits.columns:
            return pd.DataFrame(columns=["supplier_id"])

        working = audits.copy()
        working["audit_date"] = pd.to_datetime(working.get("audit_date"), errors="coerce")
        recent_cutoff = RISK_REFERENCE_DATE - pd.Timedelta(days=365)
        recent_audits = working[working["audit_date"].ge(recent_cutoff)].copy()
        if recent_audits.empty:
            recent_audits = working.copy()

        audit_metrics = working.groupby("supplier_id").agg(
            audit_non_compliance_mean=("non_compliance", "mean"),
            audit_score_inverse=("score", "mean"),
        ).reset_index()
        recent_metrics = recent_audits.groupby("supplier_id").agg(
            recent_audit_non_compliance=("non_compliance", "mean"),
            recent_audit_score=("score", "mean"),
            repeat_audit_issues=("non_compliance", lambda values: (values >= 3).sum()),
        ).reset_index()

        latest_audits = (
            working.sort_values("audit_date")
            .groupby("supplier_id")
            .tail(2)
            .sort_values(["supplier_id", "audit_date"])
        )
        trend_rows: list[dict] = []
        for supplier_id, group in latest_audits.groupby("supplier_id"):
            if len(group) < 2:
                trend_rows.append({"supplier_id": supplier_id, "audit_trend_raw": 0.0})
                continue
            previous = group.iloc[-2]
            latest = group.iloc[-1]
            trend_rows.append(
                {
                    "supplier_id": supplier_id,
                    "audit_trend_raw": max(
                        float(latest["non_compliance"]) - float(previous["non_compliance"]),
                        float(previous["score"]) - float(latest["score"]),
                        0.0,
                    ),
                }
            )
        audit_metrics = audit_metrics.merge(recent_metrics, on="supplier_id", how="left")
        audit_metrics = audit_metrics.merge(pd.DataFrame(trend_rows), on="supplier_id", how="left")

        audit_metrics["audit_non_compliance_mean"] = self._relative_risk_score(
            audit_metrics["audit_non_compliance_mean"]
        )
        audit_metrics["audit_score_inverse"] = self._relative_risk_score(
            audit_metrics["audit_score_inverse"],
            higher_is_better=True,
        )
        audit_metrics["recent_audit_non_compliance"] = self._relative_risk_score(
            audit_metrics["recent_audit_non_compliance"]
        )
        audit_metrics["recent_audit_score_inverse"] = self._relative_risk_score(
            audit_metrics["recent_audit_score"],
            higher_is_better=True,
        )
        audit_metrics["audit_trend_risk"] = self._relative_risk_score(
            audit_metrics["audit_trend_raw"]
        )
        audit_metrics["repeat_audit_issue_risk"] = self._relative_risk_score(
            audit_metrics["repeat_audit_issues"]
        )
        return audit_metrics

    def _build_alert_metrics(self, alerts: pd.DataFrame) -> pd.DataFrame:
        if alerts.empty or "supplier_id" not in alerts.columns:
            return pd.DataFrame(columns=["supplier_id"])

        severity_weights = {"Low": 1.0, "Medium": 2.0, "High": 3.0, "Critical": 4.0}
        alerts = alerts.copy()
        alerts["severity_weight"] = alerts["severity"].map(severity_weights).fillna(1.0)
        alerts["is_open"] = alerts["status"].astype(str).str.upper().eq("OPEN").astype(int)
        alerts["open_weighted_severity"] = alerts["severity_weight"] * alerts["is_open"]
        alerts["is_critical_open"] = (
            alerts["severity"].astype(str).str.upper().eq("CRITICAL") & alerts["is_open"].eq(1)
        ).astype(int)

        alert_metrics = alerts.groupby("supplier_id").agg(
            open_alert_count=("is_open", "sum"),
            open_alert_severity=("open_weighted_severity", "sum"),
            critical_open_alert_risk=("is_critical_open", "sum"),
        ).reset_index()
        alert_metrics["open_alert_count"] = self._relative_risk_score(
            alert_metrics["open_alert_count"]
        )
        alert_metrics["open_alert_severity"] = self._relative_risk_score(
            alert_metrics["open_alert_severity"]
        )
        alert_metrics["critical_open_alert_risk"] = self._relative_risk_score(
            alert_metrics["critical_open_alert_risk"]
        )
        return alert_metrics

    def _build_certification_metrics(self, supplier_certifications: pd.DataFrame) -> pd.DataFrame:
        if supplier_certifications.empty or "supplier_id" not in supplier_certifications.columns:
            return pd.DataFrame(columns=["supplier_id"])

        certs = supplier_certifications.copy()
        certs["status_normalized"] = certs["status"].astype(str).str.strip().str.lower()
        certs["verified_flag"] = certs["status_normalized"].eq("verified").astype(int)
        certs["pending_flag"] = certs["status_normalized"].eq("pending").astype(int)
        certs["expiry_date_parsed"] = pd.to_datetime(certs.get("expiry_date"), errors="coerce")
        certs["issue_date_parsed"] = pd.to_datetime(certs.get("issue_date"), errors="coerce")
        certs["expired_flag"] = certs["expiry_date_parsed"].lt(RISK_REFERENCE_DATE).astype(int)
        certs["days_to_expiry"] = (
            certs["expiry_date_parsed"] - RISK_REFERENCE_DATE
        ).dt.days
        certs["days_since_issue"] = (
            RISK_REFERENCE_DATE - certs["issue_date_parsed"]
        ).dt.days
        certs["expiring_soon_flag"] = certs["days_to_expiry"].between(0, 60, inclusive="both").astype(int)
        certs["certification_staleness"] = certs["days_since_issue"].clip(lower=0).fillna(0)

        cert_metrics = certs.groupby("supplier_id").agg(
            certification_count=("id", "count"),
            verified_ratio=("verified_flag", "mean"),
            pending_ratio=("pending_flag", "mean"),
            expiry_ratio=("expired_flag", "mean"),
            expiring_soon_ratio=("expiring_soon_flag", "mean"),
            certification_staleness=("certification_staleness", "mean"),
        ).reset_index()

        cert_metrics["certification_gap_score"] = (
            0.45
            * self._relative_risk_score(cert_metrics["verified_ratio"], higher_is_better=True)
            + 0.25 * self._relative_risk_score(cert_metrics["pending_ratio"])
            + 0.30 * self._relative_risk_score(cert_metrics["expiry_ratio"])
        ).round(2)
        cert_metrics["certification_recency_risk"] = (
            0.65 * self._relative_risk_score(cert_metrics["expiring_soon_ratio"])
            + 0.35 * self._relative_risk_score(cert_metrics["certification_staleness"])
        ).round(2)

        return cert_metrics[["supplier_id", "certification_gap_score", "certification_recency_risk"]]

    def _build_commodity_metrics(
        self,
        supplier_commodity_map: pd.DataFrame,
        commodities: pd.DataFrame,
    ) -> pd.DataFrame:
        if (
            supplier_commodity_map.empty
            or commodities.empty
            or "supplier_id" not in supplier_commodity_map.columns
        ):
            return pd.DataFrame(columns=["supplier_id"])

        commodity_map = supplier_commodity_map.merge(
            commodities[["commodity_id", "risk_level", "deforestation_risk_score"]],
            on="commodity_id",
            how="left",
        )
        commodity_level_weights = {"Low": 1.0, "Medium": 2.0, "High": 3.0}
        commodity_map["risk_level_weight"] = commodity_map["risk_level"].map(commodity_level_weights)
        commodity_map["volume"] = pd.to_numeric(commodity_map["volume"], errors="coerce").fillna(0.0)
        volume_by_supplier = commodity_map.groupby("supplier_id")["volume"].transform("sum").replace(0, 1)
        commodity_map["volume_share"] = commodity_map["volume"] / volume_by_supplier
        commodity_map["commodity_risk"] = (
            commodity_map["volume_share"] * commodity_map["deforestation_risk_score"].fillna(0.0) * 100
            + commodity_map["volume_share"] * commodity_map["risk_level_weight"].fillna(1.0) * 10
        )

        commodity_metrics = commodity_map.groupby("supplier_id").agg(
            commodity_exposure_risk=("commodity_risk", "sum")
        ).reset_index()
        commodity_metrics["commodity_exposure_risk"] = self._relative_risk_score(
            commodity_metrics["commodity_exposure_risk"]
        )
        return commodity_metrics

    def _build_supplier_metrics(self, suppliers: pd.DataFrame) -> pd.DataFrame:
        supplier_metrics = suppliers.copy()
        supplier_metrics["dependency_score"] = self._relative_risk_score(
            supplier_metrics.get("dependency_score", pd.Series(dtype=float))
        )
        supplier_metrics["criticality_score"] = self._relative_risk_score(
            supplier_metrics.get("criticality_score", pd.Series(dtype=float))
        )
        supplier_metrics["country_risk_score"] = supplier_metrics.get("country").apply(
            self._country_risk_score
        )
        return supplier_metrics[
            ["supplier_id", "dependency_score", "criticality_score", "country_risk_score"]
        ]

    def _build_esg_metrics(self, esg: pd.DataFrame) -> pd.DataFrame:
        if esg.empty or "supplier_id" not in esg.columns:
            return pd.DataFrame(columns=["supplier_id"])

        environmental_config = {
            "carbon": False,
            "energy": False,
            "renewable": True,
            "water": False,
            "waste": False,
            "recycle": True,
            "pollution": False,
            "land": False,
            "deforestation": False,
            "fines": False,
        }
        social_config = {
            "labor": False,
            "injury": False,
            "turnover": False,
            "diversity": True,
            "child": False,
            "hours": False,
            "audit": False,
            "complaints": False,
            "wage": True,
            "satisfaction": True,
        }
        governance_config = {
            "corruption": False,
            "compliance": True,
            "board": True,
            "transparency": True,
            "legal": False,
            "tax": False,
            "disclosure": True,
            "data": False,
            "policy": True,
            "reporting": True,
        }

        esg_metrics = esg[["supplier_id"]].copy()
        esg_metrics["environmental_risk_score"] = self._score_weighted_feature_group(
            esg,
            environmental_config,
        )
        esg_metrics["social_risk_score"] = self._score_weighted_feature_group(esg, social_config)
        esg_metrics["governance_risk_score"] = self._score_weighted_feature_group(
            esg,
            governance_config,
        )
        return esg_metrics

    def _score_weighted_feature_group(
        self,
        frame: pd.DataFrame,
        column_config: dict[str, bool],
    ) -> pd.Series:
        component_scores = []
        for column, higher_is_better in column_config.items():
            if column not in frame.columns:
                continue
            component_scores.append(
                self._relative_risk_score(frame[column], higher_is_better=higher_is_better)
            )

        if not component_scores:
            return pd.Series(0.0, index=frame.index)

        score_frame = pd.concat(component_scores, axis=1)
        return score_frame.mean(axis=1, skipna=True).fillna(0.0).round(2)

    def _relative_risk_score(
        self,
        values: pd.Series,
        higher_is_better: bool = False,
    ) -> pd.Series:
        if values.empty:
            return pd.Series(dtype=float)

        numeric_values = pd.to_numeric(values, errors="coerce")
        valid_values = numeric_values.dropna()
        if valid_values.empty:
            return pd.Series(0.0, index=values.index)

        rank_pct = valid_values.rank(method="average", pct=True) * 100
        if higher_is_better:
            rank_pct = 100 - rank_pct

        scored = pd.Series(50.0, index=values.index, dtype=float)
        scored.loc[rank_pct.index] = rank_pct.round(2)
        return scored

    def _classify_risk_level(self, score: float) -> str:
        if score >= 60:
            return "High"
        if score >= 40:
            return "Medium"
        return "Low"

    def _country_risk_score(self, country: str | None) -> float:
        if not country:
            return 50.0

        risk_map = {
            "brazil": 78.0,
            "indonesia": 82.0,
            "india": 66.0,
            "vietnam": 62.0,
            "china": 64.0,
            "thailand": 58.0,
            "malaysia": 61.0,
            "mexico": 57.0,
            "philippines": 59.0,
            "usa": 28.0,
            "germany": 24.0,
            "france": 26.0,
            "netherlands": 22.0,
            "singapore": 18.0,
            "uk": 25.0,
        }
        return risk_map.get(str(country).strip().lower(), 50.0)
