from fastapi import APIRouter, Query

from ..schemas.analytics import (
    CertificationAnalysisResponse,
    CommodityAnalysisResponse,
    CountryAnalysisResponse,
    CountryDistributionItem,
    EsgPillarAnalysisResponse,
    ExecutiveDashboardResponse,
    HistogramBin,
    OverviewMetrics,
    RiskDistributionsResponse,
    SupplierRankingsResponse,
    TrendAnalysisResponse,
)
from ..services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
analytics_service = AnalyticsService()


@router.get("/overview", response_model=OverviewMetrics)
def get_overview_metrics() -> OverviewMetrics:
    return analytics_service.get_overview_metrics()


@router.get("/executive-dashboard", response_model=ExecutiveDashboardResponse)
def get_executive_dashboard() -> ExecutiveDashboardResponse:
    return analytics_service.get_executive_dashboard()


@router.get("/country-distribution", response_model=list[CountryDistributionItem])
def get_country_distribution() -> list[CountryDistributionItem]:
    return analytics_service.get_country_distribution()


@router.get("/country-analysis", response_model=CountryAnalysisResponse)
def get_country_analysis(
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> CountryAnalysisResponse:
    return analytics_service.get_country_analysis(country, commodity, tier, riskLevel)


@router.get("/commodity-analysis", response_model=CommodityAnalysisResponse)
def get_commodity_analysis(
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> CommodityAnalysisResponse:
    return analytics_service.get_commodity_analysis(country, commodity, tier, riskLevel)


@router.get("/supplier-rankings", response_model=SupplierRankingsResponse)
def get_supplier_rankings(
    limit: int = Query(default=8, ge=1, le=25),
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> SupplierRankingsResponse:
    return analytics_service.get_supplier_rankings(limit, country, commodity, tier, riskLevel)


@router.get("/certification-analysis", response_model=CertificationAnalysisResponse)
def get_certification_analysis(
    limit: int = Query(default=8, ge=1, le=25),
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> CertificationAnalysisResponse:
    return analytics_service.get_certification_analysis(limit, country, commodity, tier, riskLevel)


@router.get("/esg-pillar-analysis", response_model=EsgPillarAnalysisResponse)
def get_esg_pillar_analysis(
    limit: int = Query(default=8, ge=1, le=25),
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> EsgPillarAnalysisResponse:
    return analytics_service.get_esg_pillar_analysis(country, commodity, tier, riskLevel, limit)


@router.get("/trend-analysis", response_model=TrendAnalysisResponse)
def get_trend_analysis(
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> TrendAnalysisResponse:
    return analytics_service.get_trend_analysis(country, commodity, tier, riskLevel)


@router.get("/risk-distributions", response_model=RiskDistributionsResponse)
def get_risk_distributions(
    bins: int = Query(default=20, ge=1, le=50),
    country: str | None = Query(default=None),
    commodity: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
) -> RiskDistributionsResponse:
    return analytics_service.get_risk_distributions(bins, country, commodity, tier, riskLevel)


@router.get("/esg-distribution", response_model=list[HistogramBin])
def get_esg_distribution(bins: int = Query(default=20, ge=1, le=50)) -> list[HistogramBin]:
    return analytics_service.get_esg_distribution(bins=bins)
