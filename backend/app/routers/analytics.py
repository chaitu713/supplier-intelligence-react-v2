from fastapi import APIRouter, Query

from ..schemas.analytics import CountryDistributionItem, HistogramBin, OverviewMetrics
from ..services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
analytics_service = AnalyticsService()


@router.get("/overview", response_model=OverviewMetrics)
def get_overview_metrics() -> OverviewMetrics:
    return analytics_service.get_overview_metrics()


@router.get("/country-distribution", response_model=list[CountryDistributionItem])
def get_country_distribution() -> list[CountryDistributionItem]:
    return analytics_service.get_country_distribution()


@router.get("/esg-distribution", response_model=list[HistogramBin])
def get_esg_distribution(bins: int = Query(default=20, ge=1, le=50)) -> list[HistogramBin]:
    return analytics_service.get_esg_distribution(bins=bins)
