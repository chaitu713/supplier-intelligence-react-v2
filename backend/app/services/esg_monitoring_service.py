import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from .risk_service import RiskService


class EsgMonitoringService:
    def __init__(self) -> None:
        self.risk_service = RiskService()
        self.dataset_service = self.risk_service.dataset_service

    def get_overview(self) -> dict:
        frame = self._build_monitoring_frame()
        if frame.empty:
            return {
                "kpis": {
                    "totalSuppliers": 0,
                    "highEsgRiskSuppliers": 0,
                    "deterioratingSuppliers": 0,
                    "openEsgAlerts": 0,
                    "averageEsgHealth": 0.0,
                },
                "indicators": [],
                "watchlist": [],
                "alerts": [],
                "healthTrends": [],
                "mlInsights": self._empty_ml_insights(),
            }

        alerts = self._build_alerts(frame)
        trend_counts = frame["trend"].value_counts()

        return {
            "kpis": {
                "totalSuppliers": int(len(frame)),
                "highEsgRiskSuppliers": int(frame["esg_risk_score"].ge(60).sum()),
                "deterioratingSuppliers": int(frame["trend"].eq("Deteriorating").sum()),
                "openEsgAlerts": int(len(alerts)),
                "averageEsgHealth": round(float(frame["esg_health_score"].mean()), 2),
            },
            "indicators": self._build_indicators(frame),
            "watchlist": self._build_watchlist(frame),
            "alerts": alerts,
            "healthTrends": [
                {"label": "Deteriorating", "supplierCount": int(trend_counts.get("Deteriorating", 0))},
                {"label": "Stable", "supplierCount": int(trend_counts.get("Stable", 0))},
                {"label": "Improving", "supplierCount": int(trend_counts.get("Improving", 0))},
            ],
            "mlInsights": self._build_ml_insights(frame),
        }

    def _build_monitoring_frame(self) -> pd.DataFrame:
        risk_frame = self.risk_service._build_supplier_risk_frame()
        if risk_frame.empty:
            return risk_frame

        esg = self.dataset_service.load_esg_frame()
        commodities = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.commodities_file,
            "commodities",
        )
        supplier_commodity_map = self.dataset_service.load_optional_csv(
            self.dataset_service.settings.supplier_commodity_map_file,
            "supplier_commodity_map",
        )

        raw_columns = [
            column
            for column in [
                "supplier_id",
                "carbon",
                "energy",
                "renewable",
                "water",
                "waste",
                "recycle",
                "pollution",
                "labor",
                "injury",
                "turnover",
                "diversity",
                "child",
                "hours",
                "audit",
                "complaints",
                "wage",
                "satisfaction",
                "land",
                "deforestation",
                "fines",
                "corruption",
                "compliance",
                "board",
                "transparency",
                "legal",
                "tax",
                "disclosure",
                "data",
                "policy",
                "reporting",
            ]
            if column in esg.columns
        ]
        frame = risk_frame.merge(esg[raw_columns], on="supplier_id", how="left")
        frame = frame.merge(
            self._build_land_commodity_pressure(supplier_commodity_map, commodities),
            on="supplier_id",
            how="left",
        )

        frame["bws_risk"] = self._bounded_score(
            0.70 * self._scale_fraction(frame.get("water"))
            + 0.30 * pd.to_numeric(frame.get("country_risk_score"), errors="coerce").fillna(50.0)
        )
        frame["hrr_risk"] = self._bounded_score(
            0.42 * self._scale_fraction(frame.get("labor"))
            + 0.24 * self._scale_fraction(frame.get("child"))
            + 0.18 * self._scale_fraction(frame.get("hours"))
            + 0.16 * self._scale_fraction(frame.get("wage"), higher_is_better=True)
        )
        frame["land_use_risk"] = self._bounded_score(
            0.34 * self._scale_fraction(frame.get("land"))
            + 0.34 * self._scale_fraction(frame.get("deforestation"))
            + 0.32 * pd.to_numeric(frame.get("commodity_land_pressure"), errors="coerce").fillna(50.0)
        )
        frame["esg_health_score"] = (100 - pd.to_numeric(frame["esg_risk_score"], errors="coerce")).clip(0, 100)
        frame["trend"] = frame.apply(self._classify_trend, axis=1)
        frame["status"] = frame.apply(self._classify_status, axis=1)
        frame["primary_concern"] = frame.apply(self._primary_concern, axis=1)
        frame["recommended_action"] = frame.apply(self._recommended_action, axis=1)
        frame = self._apply_ml_monitoring(frame)
        return frame.where(pd.notna(frame), None)

    def _apply_ml_monitoring(self, frame: pd.DataFrame) -> pd.DataFrame:
        feature_columns = [
            "environmental_risk_score",
            "social_risk_score",
            "governance_risk_score",
            "esg_risk_score",
            "bws_risk",
            "hrr_risk",
            "land_use_risk",
            "carbon",
            "energy",
            "renewable",
            "water",
            "waste",
            "recycle",
            "pollution",
            "labor",
            "injury",
            "turnover",
            "diversity",
            "child",
            "hours",
            "audit",
            "complaints",
            "wage",
            "satisfaction",
            "land",
            "deforestation",
            "fines",
            "corruption",
            "compliance",
            "board",
            "transparency",
            "legal",
            "tax",
            "disclosure",
            "data",
            "policy",
            "reporting",
            "open_alert_severity",
            "certification_gap_score",
            "audit_non_compliance_mean",
            "commodity_exposure_risk",
            "country_risk_score",
        ]
        available_columns = [column for column in feature_columns if column in frame.columns]
        if len(frame) < 10 or not available_columns:
            frame["ml_anomaly_score"] = 0.0
            frame["ml_confidence"] = 0.0
            frame["ml_signal"] = "Insufficient data"
            return frame

        features = frame[available_columns].apply(pd.to_numeric, errors="coerce").fillna(50.0)
        scaled_features = StandardScaler().fit_transform(features)
        model = IsolationForest(contamination=0.18, random_state=42)
        model.fit(scaled_features)

        raw_scores = -model.decision_function(scaled_features)
        min_score = float(raw_scores.min())
        max_score = float(raw_scores.max())
        if max_score == min_score:
            anomaly_scores = pd.Series(0.0, index=frame.index)
        else:
            anomaly_scores = pd.Series(
                ((raw_scores - min_score) / (max_score - min_score)) * 100,
                index=frame.index,
            ).round(2)

        frame["ml_anomaly_score"] = anomaly_scores
        frame["ml_confidence"] = anomaly_scores.apply(
            lambda value: round(min(0.95, max(0.55, float(value) / 100)), 2)
            if float(value) >= 55
            else round(max(0.35, float(value) / 120), 2)
        )
        frame["ml_signal"] = frame.apply(self._classify_ml_signal, axis=1)
        return frame

    def _classify_ml_signal(self, row: pd.Series) -> str:
        score = float(row.get("ml_anomaly_score") or 0.0)
        if score >= 75:
            return "Anomalous ESG deterioration pattern"
        if score >= 55:
            return "Elevated ESG anomaly watch"
        return "No ML anomaly detected"

    def _build_land_commodity_pressure(
        self,
        supplier_commodity_map: pd.DataFrame,
        commodities: pd.DataFrame,
    ) -> pd.DataFrame:
        if supplier_commodity_map.empty or commodities.empty:
            return pd.DataFrame(columns=["supplier_id", "commodity_land_pressure"])

        commodity_map = supplier_commodity_map.merge(
            commodities[["commodity_id", "deforestation_risk_score"]],
            on="commodity_id",
            how="left",
        )
        commodity_map["volume"] = pd.to_numeric(commodity_map.get("volume"), errors="coerce").fillna(0.0)
        totals = commodity_map.groupby("supplier_id")["volume"].transform("sum").replace(0, 1)
        commodity_map["weighted_pressure"] = (
            commodity_map["volume"]
            / totals
            * pd.to_numeric(commodity_map["deforestation_risk_score"], errors="coerce").fillna(0.0)
            * 100
        )
        return commodity_map.groupby("supplier_id").agg(
            commodity_land_pressure=("weighted_pressure", "sum")
        ).reset_index()

    def _build_indicators(self, frame: pd.DataFrame) -> list[dict]:
        configs = [
            ("bws", "BWS", "Environmental", "bws_risk", "Water stress exposure across supplier locations", True),
            ("hrr", "HRR", "Social", "hrr_risk", "Human-rights and workforce risk signal", True),
            ("landUse", "Land Use", "Environmental", "land_use_risk", "Land-use and deforestation pressure", True),
            ("carbon", "Carbon", "Environmental", "carbon", "Carbon emissions intensity", False),
            ("energy", "Energy", "Environmental", "energy", "Energy consumption intensity", False),
            ("renewable", "Renewable", "Environmental", "renewable", "Renewable energy adoption", False),
            ("water", "Water", "Environmental", "water", "Water usage and stress signal", False),
            ("waste", "Waste", "Environmental", "waste", "Waste generation intensity", False),
            ("recycle", "Recycle", "Environmental", "recycle", "Recycling and circularity performance", False),
            ("pollution", "Pollution", "Environmental", "pollution", "Pollution exposure and incident risk", False),
            ("deforestation", "Deforestation", "Environmental", "deforestation", "Deforestation exposure", False),
            ("fines", "Environmental Fines", "Environmental Compliance", "fines", "Environmental fines and penalties", False),
            ("labor", "Labor", "Social", "labor", "Labor standards risk", False),
            ("injury", "Injury", "Social", "injury", "Workplace injury rate", False),
            ("turnover", "Turnover", "Social", "turnover", "Workforce turnover pressure", False),
            ("diversity", "Diversity", "Social", "diversity", "Diversity and inclusion performance", False),
            ("child", "Child Risk", "Social", "child", "Child-labor exposure", False),
            ("hours", "Hours", "Social", "hours", "Excessive working-hours risk", False),
            ("audit", "Social Audit", "Social Assurance", "audit", "Social audit performance", False),
            ("complaints", "Complaints", "Social Assurance", "complaints", "Workforce complaints signal", False),
            ("wage", "Wage", "Social", "wage", "Wage fairness performance", False),
            ("satisfaction", "Satisfaction", "Social", "satisfaction", "Worker satisfaction performance", False),
            ("corruption", "Corruption", "Governance", "corruption", "Corruption and ethics risk", False),
            ("compliance", "Compliance", "Governance", "compliance", "Regulatory compliance performance", False),
            ("board", "Board", "Governance", "board", "Board oversight maturity", False),
            ("transparency", "Transparency", "Governance", "transparency", "Disclosure transparency", False),
            ("legal", "Legal", "Governance Compliance", "legal", "Legal incident exposure", False),
            ("tax", "Tax", "Governance Compliance", "tax", "Tax conduct risk", False),
            ("disclosure", "Disclosure", "Governance", "disclosure", "ESG disclosure maturity", False),
            ("data", "Data", "Governance", "data", "Data governance risk", False),
            ("policy", "Policy", "Governance", "policy", "Policy coverage maturity", False),
            ("reporting", "Reporting", "Governance", "reporting", "Reporting quality", False),
        ]
        indicators = []
        higher_is_better = {
            "renewable",
            "recycle",
            "diversity",
            "wage",
            "satisfaction",
            "compliance",
            "board",
            "transparency",
            "disclosure",
            "policy",
            "reporting",
        }
        for key, label, category, column, description, is_priority in configs:
            if column not in frame.columns:
                continue
            values = (
                pd.to_numeric(frame[column], errors="coerce").fillna(0.5).clip(0, 1) * 100
                if not column.endswith("_risk")
                else pd.to_numeric(frame[column], errors="coerce")
            )
            if column in higher_is_better:
                values = 100 - values
            average = round(float(values.mean()), 2)
            indicators.append(
                {
                    "key": key,
                    "label": label,
                    "category": category,
                    "averageRisk": average,
                    "highRiskSuppliers": int(values.ge(60).sum()),
                    "trend": "Watch" if average >= 60 else "Stable",
                    "description": description,
                    "isPriority": is_priority,
                }
            )
        return indicators

    def _build_watchlist(self, frame: pd.DataFrame) -> list[dict]:
        watchlist = frame.sort_values(
            ["ml_anomaly_score", "esg_risk_score", "land_use_risk", "bws_risk", "hrr_risk"],
            ascending=False,
        ).head(12)
        return [
            {
                "supplierId": int(row["supplier_id"]),
                "supplierName": str(row.get("supplier_name")),
                "country": row.get("country"),
                "tier": row.get("tier"),
                "esgRiskScore": round(float(row.get("esg_risk_score", 0.0) or 0.0), 2),
                "esgHealthScore": round(float(row.get("esg_health_score", 0.0) or 0.0), 2),
                "bwsRisk": round(float(row.get("bws_risk", 0.0) or 0.0), 2),
                "hrrRisk": round(float(row.get("hrr_risk", 0.0) or 0.0), 2),
                "landUseRisk": round(float(row.get("land_use_risk", 0.0) or 0.0), 2),
                "mlAnomalyScore": round(float(row.get("ml_anomaly_score", 0.0) or 0.0), 2),
                "mlConfidence": round(float(row.get("ml_confidence", 0.0) or 0.0), 2),
                "trend": row.get("trend"),
                "status": row.get("status"),
                "primaryConcern": row.get("primary_concern"),
                "recommendedAction": row.get("recommended_action"),
            }
            for _, row in watchlist.iterrows()
        ]

    def _build_alerts(self, frame: pd.DataFrame) -> list[dict]:
        alerts = []
        sorted_frame = frame.sort_values(["esg_risk_score", "land_use_risk"], ascending=False)
        for _, row in sorted_frame.iterrows():
            checks = [
                ("BWS", row.get("bws_risk"), "Water stress elevated"),
                ("HRR", row.get("hrr_risk"), "Human-rights risk above threshold"),
                ("Land Use", row.get("land_use_risk"), "Land-use or deforestation pressure"),
                ("ESG", row.get("esg_risk_score"), "Composite ESG risk above threshold"),
            ]
            for indicator, score, message in checks:
                numeric_score = float(score or 0.0)
                if numeric_score < 60:
                    continue
                alerts.append(
                    {
                        "id": f"{int(row['supplier_id'])}-{indicator.lower().replace(' ', '-')}",
                        "supplierId": int(row["supplier_id"]),
                        "supplierName": str(row.get("supplier_name")),
                        "severity": "Critical" if numeric_score >= 75 else "High",
                        "indicator": indicator,
                        "message": f"{message} ({numeric_score:.1f})",
                        "recommendedAction": self._recommended_action(row),
                    }
                )
                break
            if len(alerts) >= 8:
                break
        return alerts

    def _build_ml_insights(self, frame: pd.DataFrame) -> dict:
        flagged = frame[pd.to_numeric(frame["ml_anomaly_score"], errors="coerce").ge(55)].copy()
        flagged = flagged.sort_values("ml_anomaly_score", ascending=False).head(6)
        average_score = round(float(pd.to_numeric(frame["ml_anomaly_score"], errors="coerce").mean()), 2)

        return {
            "modelName": "Isolation Forest ESG anomaly detector",
            "monitoringMode": "On-demand snapshot from latest available datasets",
            "flaggedSuppliers": int(len(flagged)),
            "averageAnomalyScore": average_score,
            "topSignals": [
                "Cross-supplier anomaly detection across ESG, alert, audit, certification, country, and commodity features",
                "Higher score means the supplier behaves unusually compared with the current supplier population",
                "Current model is unsupervised because labeled historical ESG deterioration outcomes are not available",
            ],
            "dataLimitations": [
                "ESG indicator files are current-state records without observation dates",
                "No scheduled background ingestion job is running yet",
                "True continuous monitoring needs dated ESG observations or periodic data snapshots",
            ],
            "flaggedSupplierDetails": [
                {
                    "supplierId": int(row["supplier_id"]),
                    "supplierName": str(row.get("supplier_name")),
                    "anomalyScore": round(float(row.get("ml_anomaly_score", 0.0) or 0.0), 2),
                    "confidence": round(float(row.get("ml_confidence", 0.0) or 0.0), 2),
                    "signal": str(row.get("ml_signal")),
                }
                for _, row in flagged.iterrows()
            ],
        }

    def _empty_ml_insights(self) -> dict:
        return {
            "modelName": "Isolation Forest ESG anomaly detector",
            "monitoringMode": "On-demand snapshot from latest available datasets",
            "flaggedSuppliers": 0,
            "averageAnomalyScore": 0.0,
            "topSignals": [],
            "dataLimitations": [
                "No supplier records were available for ML scoring",
            ],
            "flaggedSupplierDetails": [],
        }

    def _classify_trend(self, row: pd.Series) -> str:
        pressure = max(
            float(row.get("bws_risk") or 0.0),
            float(row.get("hrr_risk") or 0.0),
            float(row.get("land_use_risk") or 0.0),
            float(row.get("esg_risk_score") or 0.0),
        )
        if pressure >= 70 or float(row.get("open_alert_severity") or 0.0) >= 65:
            return "Deteriorating"
        if pressure < 40 and float(row.get("certification_gap_score") or 0.0) < 45:
            return "Improving"
        return "Stable"

    def _classify_status(self, row: pd.Series) -> str:
        if row["trend"] == "Deteriorating":
            return "Action Required"
        if float(row.get("esg_risk_score") or 0.0) >= 60:
            return "Watch"
        return "Healthy"

    def _primary_concern(self, row: pd.Series) -> str:
        concerns = {
            "BWS": float(row.get("bws_risk") or 0.0),
            "HRR": float(row.get("hrr_risk") or 0.0),
            "Land Use": float(row.get("land_use_risk") or 0.0),
            "ESG Pillars": float(row.get("esg_risk_score") or 0.0),
        }
        return max(concerns, key=concerns.get)

    def _recommended_action(self, row: pd.Series) -> str:
        concern = row.get("primary_concern") or self._primary_concern(row)
        actions = {
            "BWS": "Request water stewardship plan and site-level water evidence",
            "HRR": "Trigger labor standards review and request corrective action evidence",
            "Land Use": "Request plot-level traceability and deforestation evidence",
            "ESG Pillars": "Open supplier ESG review and validate pillar-level disclosures",
        }
        return actions.get(concern, "Open supplier ESG review")

    def _scale_fraction(self, values: pd.Series | None, higher_is_better: bool = False) -> pd.Series:
        if values is None:
            return pd.Series(dtype=float)
        scaled = pd.to_numeric(values, errors="coerce").fillna(0.5).clip(0, 1) * 100
        return 100 - scaled if higher_is_better else scaled

    def _bounded_score(self, values: pd.Series) -> pd.Series:
        return pd.to_numeric(values, errors="coerce").fillna(50.0).clip(0, 100).round(2)
