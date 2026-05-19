import { useState } from "react";
import { ApiError } from "../api/client";
import type {
  AnalyticsFilters,
  CommodityAnalysisItem,
  CountryAnalysisItem,
  EsgPillarSupplierItem,
  HistogramBin,
  SupplierRankingsResponse,
} from "../api/analytics";
import type {
  EsgAlertItem,
  EsgMlInsights,
  EsgWatchlistSupplier,
} from "../api/esgMonitoring";
import { PlotlyChart } from "../components/common/PlotlyChart";
import { useCommodityAnalysis } from "../features/analytics/hooks/useCommodityAnalysis";
import { useCountryAnalysis } from "../features/analytics/hooks/useCountryAnalysis";
import { useEsgPillarAnalysis } from "../features/analytics/hooks/useEsgPillarAnalysis";
import { useRiskDistributions } from "../features/analytics/hooks/useRiskDistributions";
import { useSupplierRankings } from "../features/analytics/hooks/useSupplierRankings";
import { useTrendAnalysis } from "../features/analytics/hooks/useTrendAnalysis";
import { useEsgMonitoringOverview } from "../features/esg-monitoring/hooks/useEsgMonitoring";
import type { SupplierRankingItem } from "../api/analytics";

export function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [rankingView, setRankingView] = useState<"chart" | "table" | "compare">("chart");
  const distributionsQuery = useRiskDistributions(7, filters);
  const countryAnalysisQuery = useCountryAnalysis(filters);
  const commodityAnalysisQuery = useCommodityAnalysis(filters);
  const supplierRankingsQuery = useSupplierRankings(8, filters);
  const esgPillarQuery = useEsgPillarAnalysis(filters);
  const esgMonitoringQuery = useEsgMonitoringOverview();
  const trendAnalysisQuery = useTrendAnalysis(filters);
  const errorMessage = getErrorMessage(
    distributionsQuery.error ??
      countryAnalysisQuery.error ??
      commodityAnalysisQuery.error ??
      supplierRankingsQuery.error ??
      esgPillarQuery.error ??
      esgMonitoringQuery.error ??
      trendAnalysisQuery.error,
  );
  const distributions = distributionsQuery.data;
  const countryAnalysis = countryAnalysisQuery.data;
  const commodityAnalysis = commodityAnalysisQuery.data;
  const supplierRankings = supplierRankingsQuery.data;
  const esgPillars = esgPillarQuery.data;
  const esgMonitoring = esgMonitoringQuery.data;
  const trendAnalysis = trendAnalysisQuery.data;
  const activeFilterEntries = Object.entries(filters).filter(([, value]) => Boolean(value));
  const clearFilters = () => setFilters({});
  const topCountry = [...(countryAnalysis?.countries ?? [])].sort(
    (a, b) => b.avgOverallRisk - a.avgOverallRisk,
  )[0];
  const topCommodity = [...(commodityAnalysis?.commodities ?? [])].sort(
    (a, b) => b.avgOverallRisk - a.avgOverallRisk,
  )[0];
  const topSupplier = supplierRankings?.topOverallRisk?.[0];
  const latestTrend = trendAnalysis?.operational?.[trendAnalysis.operational.length - 1];
  const previousTrend =
    trendAnalysis && trendAnalysis.operational.length > 1
      ? trendAnalysis.operational[trendAnalysis.operational.length - 2]
      : undefined;
  const latestDelayShift =
    latestTrend && previousTrend ? latestTrend.avgDelayDays - previousTrend.avgDelayDays : null;
  const countryOptions = uniqueSorted(countryAnalysis?.countries.map((item) => item.country) ?? []);
  const commodityOptions = uniqueSorted(
    commodityAnalysis?.commodities.map((item) => item.commodity) ?? [],
  );
  const tierOptions = uniqueSorted(
    [
      ...(supplierRankings?.topOverallRisk ?? []),
      ...(supplierRankings?.topOperationalRisk ?? []),
      ...(supplierRankings?.topEsgRisk ?? []),
      ...(supplierRankings?.lowestRisk ?? []),
    ]
      .map((item) => item.tier)
      .filter(Boolean) as string[],
  );

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header overflow-hidden px-8 py-8 animate-fade-in">
          <div
            className="relative rounded-[2rem] border px-6 py-6 sm:px-8"
            style={{
              borderColor: "var(--primary-muted)",
              background:
                "radial-gradient(circle at top left, rgba(111, 214, 145, 0.18), transparent 36%), linear-gradient(135deg, #f8fcf7 0%, #f1f7f2 45%, #f9fcfa 100%)",
            }}
          >
            {/* Decorative grid pattern */}
            <svg className="pointer-events-none absolute right-6 top-6 h-28 w-28 text-[var(--primary)] opacity-[0.04]" viewBox="0 0 112 112" fill="none">
              <rect x="8" y="8" width="96" height="96" rx="8" stroke="currentColor" strokeWidth="1" />
              <line x1="36" y1="8" x2="36" y2="104" stroke="currentColor" strokeWidth="0.6" />
              <line x1="64" y1="8" x2="64" y2="104" stroke="currentColor" strokeWidth="0.6" />
              <line x1="8" y1="36" x2="104" y2="36" stroke="currentColor" strokeWidth="0.6" />
              <line x1="8" y1="64" x2="104" y2="64" stroke="currentColor" strokeWidth="0.6" />
            </svg>
            <div className="relative">
              <p className="eyebrow text-sm">Analytics</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                Detailed risk distributions and analytical breakdowns
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                This workspace goes deeper than the Executive Dashboard and explains how
                supplier risk is distributed across the network. Phase 1 starts with
                detailed overall, operational, ESG, and trend analysis across the network.
              </p>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="surface-card sticky top-[calc(var(--nav-h)+0.75rem)] z-30 px-6 py-4 animate-slide-up">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Filters
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
                Refine analytics across geography, commodity, tier, and risk level
              </h2>
              </div>
              <ActiveFilterChips
                entries={activeFilterEntries}
                onRemove={(key) =>
                  setFilters((prev) => ({
                    ...prev,
                    [key]: undefined,
                  }))
                }
                onClear={clearFilters}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <FilterSelect
                label="Country"
                value={filters.country ?? ""}
                options={countryOptions}
                onChange={(value) => setFilters((prev) => ({ ...prev, country: value || undefined }))}
              />
              <FilterSelect
                label="Commodity"
                value={filters.commodity ?? ""}
                options={commodityOptions}
                onChange={(value) => setFilters((prev) => ({ ...prev, commodity: value || undefined }))}
              />
              <FilterSelect
                label="Tier"
                value={filters.tier ?? ""}
                options={tierOptions}
                onChange={(value) => setFilters((prev) => ({ ...prev, tier: value || undefined }))}
              />
              <FilterSelect
                label="Risk Level"
                value={filters.riskLevel ?? ""}
                options={["High", "Medium", "Low"]}
                onChange={(value) => setFilters((prev) => ({ ...prev, riskLevel: value || undefined }))}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)]"
                  style={{ borderColor: "var(--border)" }}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </section>

        <AnalyticsInsightStrip
          activeFilterCount={activeFilterEntries.length}
          topCountry={topCountry}
          topCommodity={topCommodity}
          topSupplier={topSupplier}
          latestTrend={latestTrend}
          latestDelayShift={latestDelayShift}
          isLoading={
            countryAnalysisQuery.isLoading ||
            commodityAnalysisQuery.isLoading ||
            supplierRankingsQuery.isLoading ||
            trendAnalysisQuery.isLoading
          }
        />

        <AnalyticsSectionNav />

        <section id="analytics-overview" className="surface-card scroll-mt-28 px-8 py-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Risk Distributions
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Distribution-level view of supplier risk across the network
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              These charts show how supplier scores cluster across the network, making it
              easier to spot concentration, spread, and skew across overall, operational,
              and ESG risk.
            </p>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            <AnalyticsHistogramCard
              title="Overall Risk Distribution"
              description="Histogram-style view of combined supplier risk across the current network."
              bins={distributions?.overall ?? []}
              isLoading={distributionsQuery.isLoading}
              onClearFilters={clearFilters}
              color="#166534"
            />
            <AnalyticsHistogramCard
              title="Operational Risk Distribution"
              description="Histogram-style view of delivery, quality, audit, and execution pressure."
              bins={distributions?.operational ?? []}
              isLoading={distributionsQuery.isLoading}
              onClearFilters={clearFilters}
              color="#0f766e"
            />
            <AnalyticsHistogramCard
              title="ESG Risk Distribution"
              description="Histogram-style view of environmental, social, and governance exposure."
              bins={distributions?.esg ?? []}
              isLoading={distributionsQuery.isLoading}
              onClearFilters={clearFilters}
              color="#7c3aed"
            />
          </div>
        </section>

        <section id="analytics-country" className="surface-card scroll-mt-28 px-8 py-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Country Analysis
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Detailed country-level comparison across supplier concentration and risk
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              This section compares how countries differ across supplier concentration,
              overall risk, operational risk, ESG risk, and country-level supplier spread.
            </p>
          </div>

          <KeyFindingPanel
            eyebrow="Key Finding"
            title={
              topCountry
                ? `${topCountry.country} has the highest average overall risk in this view.`
                : "Country risk concentration will appear once data is available."
            }
            detail={
              topCountry
                ? `${topCountry.supplierCount} suppliers average ${topCountry.avgOverallRisk.toFixed(
                    2,
                  )} overall risk, with ${topCountry.expiredCertifications} expired certifications.`
                : "Use the filters above to narrow the country comparison."
            }
            action="Inspect countries with both high risk and high supplier concentration first."
          />

          <div className="mt-8">
            <CountryRiskComparisonChart
              items={countryAnalysis?.countries ?? []}
              isLoading={countryAnalysisQuery.isLoading}
            />
          </div>

          <CountryAnalysisTable
            items={countryAnalysis?.countries ?? []}
            isLoading={countryAnalysisQuery.isLoading}
            onClearFilters={clearFilters}
          />
        </section>

        <section id="analytics-commodity" className="surface-card scroll-mt-28 px-8 py-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Commodity Analysis
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Detailed commodity-level comparison across exposure, risk, and deforestation context
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              This section compares commodity groups by supplier concentration, average risk,
              deforestation pressure, and average mapped volume.
            </p>
          </div>

          <KeyFindingPanel
            eyebrow="Key Finding"
            title={
              topCommodity
                ? `${topCommodity.commodity} is the highest-risk commodity group in this view.`
                : "Commodity exposure will appear once data is available."
            }
            detail={
              topCommodity
                ? `${topCommodity.supplierCount} suppliers average ${topCommodity.avgOverallRisk.toFixed(
                    2,
                  )} overall risk, with ${topCommodity.deforestationRiskScore.toFixed(
                    2,
                  )} deforestation pressure.`
                : "Use commodity filters to isolate a sourcing category."
            }
            action="Compare risk score with volume to separate concentrated risk from broad exposure."
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <CommodityRiskComparisonChart
              items={commodityAnalysis?.commodities ?? []}
              isLoading={commodityAnalysisQuery.isLoading}
            />
            <CommodityExposureContextChart
              items={commodityAnalysis?.commodities ?? []}
              isLoading={commodityAnalysisQuery.isLoading}
            />
          </div>

          <CommodityAnalysisTable
            items={commodityAnalysis?.commodities ?? []}
            isLoading={commodityAnalysisQuery.isLoading}
            onClearFilters={clearFilters}
          />
        </section>

        <section id="analytics-suppliers" className="surface-card scroll-mt-28 px-8 py-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Supplier Rankings
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Ranked supplier comparisons across overall, operational, and ESG risk
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              This section compares suppliers directly across the highest overall risk,
              highest operational risk, highest ESG risk, and lowest overall risk groups.
            </p>
          </div>

          <KeyFindingPanel
            eyebrow="Key Finding"
            title={
              topSupplier
                ? `${topSupplier.supplierName} is currently the highest overall-risk supplier.`
                : "Supplier ranking insights will appear once data is available."
            }
            detail={
              topSupplier
                ? `${topSupplier.country ?? "Unknown country"} | ${topSupplier.tier ?? "Unknown tier"} | primary driver: ${topSupplier.primaryDriver}.`
                : "Rankings respond to the active filter set."
            }
            action="Start with suppliers that rank high across more than one risk dimension."
          />

          <RankingViewToggle value={rankingView} onChange={setRankingView} />

          {rankingView === "chart" ? (
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <SupplierRankingChart
                title="Top Overall Risk Suppliers"
                items={supplierRankings?.topOverallRisk ?? []}
                isLoading={supplierRankingsQuery.isLoading}
                scoreKey="overallRiskScore"
                gradient={["#991b1b", "#fecaca"]}
                onClearFilters={clearFilters}
              />
              <SupplierRankingChart
                title="Top Operational Risk Suppliers"
                items={supplierRankings?.topOperationalRisk ?? []}
                isLoading={supplierRankingsQuery.isLoading}
                scoreKey="operationalRiskScore"
                gradient={["#b91c1c", "#fecaca"]}
                onClearFilters={clearFilters}
              />
              <SupplierRankingChart
                title="Top ESG Risk Suppliers"
                items={supplierRankings?.topEsgRisk ?? []}
                isLoading={supplierRankingsQuery.isLoading}
                scoreKey="esgRiskScore"
                gradient={["#7f1d1d", "#fee2e2"]}
                onClearFilters={clearFilters}
              />
              <SupplierRankingChart
                title="Lowest Risk Suppliers"
                items={supplierRankings?.lowestRisk ?? []}
                isLoading={supplierRankingsQuery.isLoading}
                scoreKey="overallRiskScore"
                gradient={["#14532d", "#dcfce7"]}
                reverseGradient
                onClearFilters={clearFilters}
              />
            </div>
          ) : rankingView === "table" ? (
            <SupplierRankingTable
              rankings={supplierRankings}
              isLoading={supplierRankingsQuery.isLoading}
              onClearFilters={clearFilters}
            />
          ) : (
            <SupplierRankingCompare
              rankings={supplierRankings}
              isLoading={supplierRankingsQuery.isLoading}
              onClearFilters={clearFilters}
            />
          )}
        </section>

        <section id="analytics-esg" className="surface-card scroll-mt-28 px-8 py-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              ESG Pillar Analysis
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Environmental, social, and governance pillar comparison across countries and suppliers
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              This section breaks ESG into its core pillars so users can compare where
              environmental, social, or governance exposure is strongest.
            </p>
          </div>

          <KeyFindingPanel
            eyebrow="Key Finding"
            title={buildEsgFindingTitle(esgPillars?.byCountry ?? [])}
            detail="Use the ESG pillar split to identify whether exposure is environmental, social, or governance-led."
            action="Pair ESG pillar hotspots with supplier rankings before choosing remediation actions."
          />

          <EsgMonitoringAnalyticsPanel
            suppliers={esgMonitoring?.watchlist ?? []}
            alerts={esgMonitoring?.alerts ?? []}
            mlInsights={esgMonitoring?.mlInsights}
            isLoading={esgMonitoringQuery.isLoading}
          />

          <TrendMovementPanel
            countryMovement={getTrendMovement(trendAnalysis?.countryTrends ?? [])}
            commodityMovement={getTrendMovement(trendAnalysis?.commodityTrends ?? [])}
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <EsgPillarByCountryChart
              items={esgPillars?.byCountry ?? []}
              isLoading={esgPillarQuery.isLoading}
            />
            <TopSupplierEsgPillarChart
              items={esgPillars?.topSuppliers ?? []}
              isLoading={esgPillarQuery.isLoading}
            />
          </div>
        </section>

        <section id="analytics-trends" className="surface-card scroll-mt-28 px-8 py-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Trend Analysis
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Monthly operational, country, and commodity trendlines
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              This section shows how delivery performance and regional or commodity
              execution patterns move over time using the dated transaction history in the current dataset.
            </p>
          </div>

          <KeyFindingPanel
            eyebrow="Key Finding"
            title={
              latestTrend
                ? `Latest delay is ${latestTrend.avgDelayDays.toFixed(2)} days for ${latestTrend.period}.`
                : "Trend insights will appear once dated transaction history is available."
            }
            detail={
              latestDelayShift === null
                ? "Monthly movement needs at least two periods."
                : `Delay moved ${
                    latestDelayShift >= 0 ? "+" : ""
                  }${latestDelayShift.toFixed(2)} days versus the previous month.`
            }
            action="Use the country and commodity trend charts to locate where operational movement is coming from."
          />

          <div
            className="mt-8 rounded-[2rem] border px-6 py-5"
            style={{
              borderColor: "rgba(22, 101, 52, 0.12)",
              background:
                "linear-gradient(135deg, rgba(22, 101, 52, 0.08) 0%, rgba(15, 118, 110, 0.05) 52%, rgba(251, 146, 60, 0.08) 100%)",
            }}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <TrendIntroMetric
                label="Time Coverage"
                value="2023-01 to 2025-12"
                detail="Full transaction history used for monthly trend curves"
              />
              <TrendIntroMetric
                label="Primary Metric"
                value="Delay Days"
                detail="Country and commodity comparisons currently use average delivery delay"
              />
              <TrendIntroMetric
                label="View Style"
                value="Monthly"
                detail="All lines are shown month-by-month for cleaner progression tracking"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-6">
            <OperationalTrendChart
              items={trendAnalysis?.operational ?? []}
              isLoading={trendAnalysisQuery.isLoading}
            />
          </div>

          <div className="mt-6 grid gap-6">
            <MultiSeriesTrendChart
              title="Country Trend Comparison"
              description="Monthly average delivery delay compared across the leading supplier countries in the current view."
              series={trendAnalysis?.countryTrends ?? []}
              isLoading={trendAnalysisQuery.isLoading}
              valueLabel="Avg Delay Days"
              palette={["#166534", "#2f855a", "#4ade80", "#86efac"]}
            />
            <MultiSeriesTrendChart
              title="Commodity Trend Comparison"
              description="Monthly average delivery delay compared across the leading commodity groups in the current view."
              series={trendAnalysis?.commodityTrends ?? []}
              isLoading={trendAnalysisQuery.isLoading}
              valueLabel="Avg Delay Days"
              palette={["#7c2d12", "#c2410c", "#fb923c", "#fed7aa"]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AnalyticsInsightStrip({
  activeFilterCount,
  topCountry,
  topCommodity,
  topSupplier,
  latestTrend,
  latestDelayShift,
  isLoading,
}: {
  activeFilterCount: number;
  topCountry: CountryAnalysisItem | undefined;
  topCommodity: CommodityAnalysisItem | undefined;
  topSupplier: SupplierRankingItem | undefined;
  latestTrend:
    | {
        period: string;
        avgDelayDays: number;
      }
    | undefined;
  latestDelayShift: number | null;
  isLoading: boolean;
}) {
  const delayDetail =
    latestDelayShift === null
      ? "No prior period"
      : `${latestDelayShift >= 0 ? "+" : ""}${latestDelayShift.toFixed(2)} days vs prior month`;

  return (
    <section className="visual-card p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Analytics Overview</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
            What needs attention in the current analytical view
          </h2>
        </div>
        <span className="tag tag-neutral">
          {activeFilterCount ? `${activeFilterCount} filters active` : "Full network view"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label="Highest-Risk Country"
          value={isLoading ? "Loading..." : topCountry?.country ?? "-"}
          detail={
            topCountry
              ? `${topCountry.avgOverallRisk.toFixed(2)} avg risk | ${topCountry.supplierCount} suppliers`
              : "No country data"
          }
        />
        <InsightCard
          label="Highest-Risk Commodity"
          value={isLoading ? "Loading..." : topCommodity?.commodity ?? "-"}
          detail={
            topCommodity
              ? `${topCommodity.avgOverallRisk.toFixed(2)} avg risk | ${topCommodity.supplierCount} suppliers`
              : "No commodity data"
          }
        />
        <InsightCard
          label="Top Supplier"
          value={isLoading ? "Loading..." : topSupplier?.supplierName ?? "-"}
          detail={
            topSupplier
              ? `${topSupplier.overallRiskScore.toFixed(2)} overall risk | ${topSupplier.primaryDriver}`
              : "No ranking data"
          }
        />
        <InsightCard
          label="Latest Delay"
          value={isLoading ? "Loading..." : latestTrend ? `${latestTrend.avgDelayDays.toFixed(2)} d` : "-"}
          detail={latestTrend ? `${latestTrend.period} | ${delayDetail}` : "No trend data"}
        />
      </div>
    </section>
  );
}

function InsightCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="group rounded-[1.35rem] border border-[var(--border)] bg-white/80 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(22,101,52,0.12)] hover:shadow-[0_4px_12px_rgba(22,101,52,0.06)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-semibold text-[var(--text)] transition-colors duration-200 group-hover:text-[var(--primary)]" title={value}>
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
        {detail}
      </p>
    </div>
  );
}

function AnalyticsSectionNav() {
  const links = [
    { label: "Overview", href: "#analytics-overview", icon: "◈" },
    { label: "Country", href: "#analytics-country", icon: "◉" },
    { label: "Commodity", href: "#analytics-commodity", icon: "◆" },
    { label: "Suppliers", href: "#analytics-suppliers", icon: "◎" },
    { label: "ESG", href: "#analytics-esg", icon: "◇" },
    { label: "Trends", href: "#analytics-trends", icon: "◌" },
  ];

  return (
    <nav
      className="sticky top-[calc(var(--nav-h)+8.25rem)] z-20 rounded-[1.1rem] border px-3 py-2.5 backdrop-blur-xl"
      style={{
        borderColor: "var(--border)",
        background: "rgba(255, 255, 255, 0.88)",
        boxShadow: "var(--shadow-sm), 0 0 0 1px rgba(255,255,255,0.6) inset",
      }}
    >
      <div className="flex gap-1.5 overflow-x-auto">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
          >
            <span className="text-[10px] opacity-50">{link.icon}</span>
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function ActiveFilterChips({
  entries,
  onRemove,
  onClear,
}: {
  entries: Array<[string, string | undefined]>;
  onRemove: (key: keyof AnalyticsFilters) => void;
  onClear: () => void;
}) {
  if (!entries.length) {
    return <span className="tag tag-neutral">Full network view</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(([key, value]) => (
        <button
          key={key}
          type="button"
          className="tag tag-primary"
          onClick={() => onRemove(key as keyof AnalyticsFilters)}
          title="Remove filter"
        >
          {formatFilterLabel(key)}: {value}
        </button>
      ))}
      <button type="button" className="tag tag-neutral" onClick={onClear}>
        Clear all
      </button>
    </div>
  );
}

function EmptyStateWithAction({
  message,
  onClearFilters,
}: {
  message: string;
  onClearFilters?: () => void;
}) {
  return (
    <div className="empty-state px-6 py-12 text-center text-sm">
      <p>{message}</p>
      {onClearFilters ? (
        <button type="button" className="btn-secondary mt-4" onClick={onClearFilters}>
          Clear Filters
        </button>
      ) : null}
    </div>
  );
}

function KeyFindingPanel({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
}) {
  return (
    <div
      className="mt-6 rounded-[1.5rem] border bg-[rgba(240,253,244,0.62)] px-5 py-4"
      style={{
        borderColor: "rgba(22,101,52,0.14)",
        borderLeft: "4px solid rgba(22, 101, 52, 0.35)",
      }}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr] xl:items-center">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
        </div>
        <div className="rounded-[1rem] border border-[var(--border)] bg-white/78 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Suggested Read
          </p>
          <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text)]">{action}</p>
        </div>
      </div>
    </div>
  );
}

function AnalyticsHistogramCard({
  title,
  description,
  bins,
  isLoading,
  onClearFilters,
  color,
}: {
  title: string;
  description: string;
  bins: HistogramBin[];
  isLoading: boolean;
  onClearFilters?: () => void;
  color: string;
}) {
  const normalizedBins = bins.map((bin) => ({
    ...bin,
    count: Number(bin.count) || 0,
  }));

  const tickText = normalizedBins.map((bin) => `${bin.start.toFixed(2)}-${bin.end.toFixed(2)}`);

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">{title}</h3>
        <p className="visual-description">{description}</p>
      </div>

      {isLoading ? (
        <div className="flex h-[320px] items-end gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="w-full animate-pulse rounded-t-2xl bg-slate-100"
              style={{ height: `${30 + ((index % 4) + 1) * 12}%` }}
            />
          ))}
        </div>
      ) : normalizedBins.length === 0 ? (
        <EmptyStateWithAction
          message="No distribution data available for the current filters."
          onClearFilters={onClearFilters}
        />
      ) : (
        <PlotlyChart
          className="h-[340px]"
          data={[
            {
              type: "bar",
              x: tickText,
              y: normalizedBins.map((bin) => bin.count),
              width: normalizedBins.map((bin) => Math.max(0, bin.end - bin.start)),
              marker: {
                color,
                line: { color, width: 0 },
              },
              barCategoryGap: "0%",
              barGap: "0%",
              hovertemplate: "Risk Range: %{customdata}<br>Count: %{y}<extra></extra>",
              customdata: tickText,
            },
          ]}
          layout={{
            bargap: 0,
            margin: { l: 56, r: 20, t: 8, b: 74 },
            xaxis: {
              title: {
                text: "Risk score range",
                font: { size: 12, color: "#64748b" },
                standoff: 18,
              },
              tickangle: normalizedBins.length > 10 ? -35 : -20,
              tickfont: { size: 11, color: "#64748b" },
              tickcolor: "#cbd5e1",
              linecolor: "#cbd5e1",
              automargin: true,
            },
            yaxis: {
              title: {
                text: "Suppliers",
                font: { size: 12, color: "#64748b" },
                standoff: 10,
              },
              tickfont: { size: 11, color: "#64748b" },
              gridcolor: "#dbeafe",
              zerolinecolor: "#dbeafe",
              tickcolor: "#cbd5e1",
              linecolor: "#cbd5e1",
              automargin: true,
            },
          }}
        />
      )}
    </section>
  );
}

function CountryRiskComparisonChart({
  items,
  isLoading,
}: {
  items: CountryAnalysisItem[];
  isLoading: boolean;
}) {
  const topItems = [...items].slice(0, 7).reverse();

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">Country Risk Comparison</h3>
        <p className="visual-description">
          Compare overall, operational, and ESG risk side by side by country.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
      ) : topItems.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No country analysis data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[360px]"
          data={[
            {
              type: "bar",
              orientation: "h",
              name: "Overall",
              y: topItems.map((item) => item.country),
              x: topItems.map((item) => item.avgOverallRisk),
              marker: { color: "#2f855a" },
              hovertemplate: "Country Name: %{y}<br>Avg Overall Risk: %{x}<extra></extra>",
            },
            {
              type: "bar",
              orientation: "h",
              name: "Operational",
              y: topItems.map((item) => item.country),
              x: topItems.map((item) => item.avgOperationalRisk),
              marker: { color: "#2b7a90" },
              hovertemplate:
                "Country Name: %{y}<br>Avg Operational Risk: %{x}<extra></extra>",
            },
            {
              type: "bar",
              orientation: "h",
              name: "ESG",
              y: topItems.map((item) => item.country),
              x: topItems.map((item) => item.avgEsgRisk),
              marker: { color: "#7c3aed" },
              hovertemplate: "Country Name: %{y}<br>Avg ESG Risk: %{x}<extra></extra>",
            },
          ]}
          layout={{
            barmode: "group",
            margin: { l: 82, r: 20, t: 12, b: 34 },
            xaxis: {
              title: {
                text: "Average Risk Score",
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "#dbeafe",
              zeroline: false,
            },
            yaxis: {
              tickfont: { size: 11, color: "#64748b" },
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.12,
            },
          }}
        />
      )}
    </section>
  );
}

function CountryAnalysisTable({
  items,
  isLoading,
  onClearFilters,
}: {
  items: CountryAnalysisItem[];
  isLoading: boolean;
  onClearFilters?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof CountryAnalysisItem>("avgOverallRisk");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sortedItems = sortItems(
    items.filter((item) => item.country.toLowerCase().includes(query.trim().toLowerCase())),
    sortKey,
    sortDirection,
  );
  const toggleSort = (key: keyof CountryAnalysisItem) => {
    setSortDirection((prev) => (sortKey === key && prev === "desc" ? "asc" : "desc"));
    setSortKey(key);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-6 py-5">
        <h3 className="text-lg font-semibold text-[var(--text)]">Country Risk Detail Table</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Detailed comparison table for supplier concentration, risk, and certification status counts.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[260px] animate-pulse bg-slate-100" />
      ) : items.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyStateWithAction
            message="No country analysis data matches the current filters."
            onClearFilters={onClearFilters}
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4">
          <input
            className="input-field md:max-w-sm"
            value={query}
            placeholder="Search country"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <SortableHeader label="Country" active={sortKey === "country"} direction={sortDirection} onClick={() => toggleSort("country")} className="px-6 py-4" />
                <SortableHeader label="Suppliers" active={sortKey === "supplierCount"} direction={sortDirection} onClick={() => toggleSort("supplierCount")} />
                <SortableHeader label="Avg Overall" active={sortKey === "avgOverallRisk"} direction={sortDirection} onClick={() => toggleSort("avgOverallRisk")} />
                <SortableHeader label="Avg Operational" active={sortKey === "avgOperationalRisk"} direction={sortDirection} onClick={() => toggleSort("avgOperationalRisk")} />
                <SortableHeader label="Avg ESG" active={sortKey === "avgEsgRisk"} direction={sortDirection} onClick={() => toggleSort("avgEsgRisk")} />
                <SortableHeader label="Expiring" active={sortKey === "expiringCertifications"} direction={sortDirection} onClick={() => toggleSort("expiringCertifications")} />
                <SortableHeader label="Expired" active={sortKey === "expiredCertifications"} direction={sortDirection} onClick={() => toggleSort("expiredCertifications")} />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.country} className="border-t border-[var(--border)]">
                  <td className="px-6 py-4 font-semibold text-[var(--text)]">{item.country}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">{item.supplierCount}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    <RiskValue value={item.avgOverallRisk} />
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgOperationalRisk.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgEsgRisk.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.expiringCertifications}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.expiredCertifications}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sortedItems.length ? (
            <EmptyStateWithAction
              message="No countries match the current table search."
              onClearFilters={onClearFilters}
            />
          ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function CommodityRiskComparisonChart({
  items,
  isLoading,
}: {
  items: CommodityAnalysisItem[];
  isLoading: boolean;
}) {
  const topItems = [...items].slice(0, 7).reverse();

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">Commodity Risk Comparison</h3>
        <p className="visual-description">
          Compare overall, operational, and ESG risk side by side by commodity.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
      ) : topItems.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No commodity analysis data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[360px]"
          data={[
            {
              type: "bar",
              orientation: "h",
              name: "Overall",
              y: topItems.map((item) => item.commodity),
              x: topItems.map((item) => item.avgOverallRisk),
              marker: { color: "#2f855a" },
              hovertemplate: "Commodity Name: %{y}<br>Avg Overall Risk: %{x}<extra></extra>",
            },
            {
              type: "bar",
              orientation: "h",
              name: "Operational",
              y: topItems.map((item) => item.commodity),
              x: topItems.map((item) => item.avgOperationalRisk),
              marker: { color: "#2b7a90" },
              hovertemplate:
                "Commodity Name: %{y}<br>Avg Operational Risk: %{x}<extra></extra>",
            },
            {
              type: "bar",
              orientation: "h",
              name: "ESG",
              y: topItems.map((item) => item.commodity),
              x: topItems.map((item) => item.avgEsgRisk),
              marker: { color: "#7c3aed" },
              hovertemplate: "Commodity Name: %{y}<br>Avg ESG Risk: %{x}<extra></extra>",
            },
          ]}
          layout={{
            barmode: "group",
            margin: { l: 108, r: 20, t: 12, b: 34 },
            xaxis: {
              title: {
                text: "Average Risk Score",
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "#dbeafe",
              zeroline: false,
            },
            yaxis: {
              tickfont: { size: 11, color: "#64748b" },
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.12,
            },
          }}
        />
      )}
    </section>
  );
}

function CommodityExposureContextChart({
  items,
  isLoading,
}: {
  items: CommodityAnalysisItem[];
  isLoading: boolean;
}) {
  const topItems = [...items]
    .sort((a, b) => b.deforestationRiskScore - a.deforestationRiskScore)
    .slice(0, 6);

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">Deforestation & Volume Context</h3>
        <p className="visual-description">
          Deforestation exposure alongside average mapped volume by commodity.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
      ) : topItems.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No commodity context data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[360px]"
          data={[
            {
              type: "bar",
              name: "Deforestation Risk",
              x: topItems.map((item) => item.commodity),
              y: topItems.map((item) => item.deforestationRiskScore),
              marker: { color: "#b45309" },
              hovertemplate:
                "Commodity Name: %{x}<br>Deforestation Risk Score: %{y}<extra></extra>",
            },
            {
              type: "scatter",
              mode: "lines+markers",
              name: "Avg Volume",
              x: topItems.map((item) => item.commodity),
              y: topItems.map((item) => item.avgVolume),
              yaxis: "y2",
              marker: { color: "#166534", size: 8 },
              line: { color: "#166534", width: 2 },
              hovertemplate: "Commodity Name: %{x}<br>Avg Volume: %{y}<extra></extra>",
            },
          ]}
          layout={{
            margin: { l: 40, r: 42, t: 12, b: 70 },
            xaxis: {
              tickangle: -25,
              tickfont: { size: 11, color: "#64748b" },
            },
            yaxis: {
              title: {
                text: "Deforestation Risk",
                font: { size: 12, color: "#64748b" },
              },
              min: 0,
              max: 1,
              showgrid: true,
              gridcolor: "#dbeafe",
              zeroline: false,
            },
            yaxis2: {
              title: {
                text: "Avg Volume",
                font: { size: 12, color: "#64748b" },
              },
              overlaying: "y",
              side: "right",
              showgrid: false,
              zeroline: false,
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.12,
            },
          }}
        />
      )}
    </section>
  );
}

function CommodityAnalysisTable({
  items,
  isLoading,
  onClearFilters,
}: {
  items: CommodityAnalysisItem[];
  isLoading: boolean;
  onClearFilters?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof CommodityAnalysisItem>("avgOverallRisk");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sortedItems = sortItems(
    items.filter((item) => item.commodity.toLowerCase().includes(query.trim().toLowerCase())),
    sortKey,
    sortDirection,
  );
  const toggleSort = (key: keyof CommodityAnalysisItem) => {
    setSortDirection((prev) => (sortKey === key && prev === "desc" ? "asc" : "desc"));
    setSortKey(key);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-6 py-5">
        <h3 className="text-lg font-semibold text-[var(--text)]">Commodity Detail Table</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Detailed comparison table for supplier concentration, risk, deforestation score, and volume.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[260px] animate-pulse bg-slate-100" />
      ) : items.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyStateWithAction
            message="No commodity analysis data matches the current filters."
            onClearFilters={onClearFilters}
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4">
          <input
            className="input-field md:max-w-sm"
            value={query}
            placeholder="Search commodity"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <SortableHeader label="Commodity" active={sortKey === "commodity"} direction={sortDirection} onClick={() => toggleSort("commodity")} className="px-6 py-4" />
                <SortableHeader label="Suppliers" active={sortKey === "supplierCount"} direction={sortDirection} onClick={() => toggleSort("supplierCount")} />
                <SortableHeader label="Avg Overall" active={sortKey === "avgOverallRisk"} direction={sortDirection} onClick={() => toggleSort("avgOverallRisk")} />
                <SortableHeader label="Avg Operational" active={sortKey === "avgOperationalRisk"} direction={sortDirection} onClick={() => toggleSort("avgOperationalRisk")} />
                <SortableHeader label="Avg ESG" active={sortKey === "avgEsgRisk"} direction={sortDirection} onClick={() => toggleSort("avgEsgRisk")} />
                <SortableHeader label="Deforestation" active={sortKey === "deforestationRiskScore"} direction={sortDirection} onClick={() => toggleSort("deforestationRiskScore")} />
                <SortableHeader label="Avg Volume" active={sortKey === "avgVolume"} direction={sortDirection} onClick={() => toggleSort("avgVolume")} />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.commodity} className="border-t border-[var(--border)]">
                  <td className="px-6 py-4 font-semibold text-[var(--text)]">{item.commodity}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">{item.supplierCount}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    <RiskValue value={item.avgOverallRisk} />
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgOperationalRisk.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgEsgRisk.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.deforestationRiskScore.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgVolume.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sortedItems.length ? (
            <EmptyStateWithAction
              message="No commodities match the current table search."
              onClearFilters={onClearFilters}
            />
          ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function RankingViewToggle({
  value,
  onChange,
}: {
  value: "chart" | "table" | "compare";
  onChange: (value: "chart" | "table" | "compare") => void;
}) {
  const options: Array<{ value: "chart" | "table" | "compare"; label: string }> = [
    { value: "chart", label: "Chart View" },
    { value: "table", label: "Table View" },
    { value: "compare", label: "Compare View" },
  ];

  return (
    <div className="mt-6 inline-flex rounded-xl border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-xs)]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-semibold transition"
          style={{
            background: value === option.value ? "var(--primary)" : "transparent",
            color: value === option.value ? "#fff" : "var(--text-secondary)",
          }}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SupplierRankingTable({
  rankings,
  isLoading,
  onClearFilters,
}: {
  rankings: SupplierRankingsResponse | undefined;
  isLoading: boolean;
  onClearFilters?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof SupplierRankingItem>("overallRiskScore");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const items = uniqueSuppliers([
    ...(rankings?.topOverallRisk ?? []),
    ...(rankings?.topOperationalRisk ?? []),
    ...(rankings?.topEsgRisk ?? []),
    ...(rankings?.lowestRisk ?? []),
  ]);
  const visibleItems = sortItems(
    items.filter((item) =>
      `${item.supplierName} ${item.country ?? ""} ${item.tier ?? ""} ${item.primaryDriver}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ),
    sortKey,
    sortDirection,
  );
  const toggleSort = (key: keyof SupplierRankingItem) => {
    setSortDirection((prev) => (sortKey === key && prev === "desc" ? "asc" : "desc"));
    setSortKey(key);
  };

  return (
    <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-6 py-5">
        <h3 className="text-lg font-semibold text-[var(--text)]">Supplier Ranking Table</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Search and sort ranked suppliers across overall, operational, and ESG risk.
        </p>
      </div>
      {isLoading ? (
        <div className="h-[260px] animate-pulse bg-slate-100" />
      ) : !items.length ? (
        <div className="px-6 py-6">
          <EmptyStateWithAction
            message="No supplier rankings match the current filters."
            onClearFilters={onClearFilters}
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4">
          <input
            className="input-field md:max-w-sm"
            value={query}
            placeholder="Search supplier, country, tier, or driver"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <SortableHeader label="Supplier" active={sortKey === "supplierName"} direction={sortDirection} onClick={() => toggleSort("supplierName")} className="px-6 py-4" />
                  <SortableHeader label="Country" active={sortKey === "country"} direction={sortDirection} onClick={() => toggleSort("country")} />
                  <SortableHeader label="Tier" active={sortKey === "tier"} direction={sortDirection} onClick={() => toggleSort("tier")} />
                  <SortableHeader label="Overall" active={sortKey === "overallRiskScore"} direction={sortDirection} onClick={() => toggleSort("overallRiskScore")} />
                  <SortableHeader label="Operational" active={sortKey === "operationalRiskScore"} direction={sortDirection} onClick={() => toggleSort("operationalRiskScore")} />
                  <SortableHeader label="ESG" active={sortKey === "esgRiskScore"} direction={sortDirection} onClick={() => toggleSort("esgRiskScore")} />
                  <SortableHeader label="Level" active={sortKey === "riskLevel"} direction={sortDirection} onClick={() => toggleSort("riskLevel")} />
                  <th className="px-4 py-4">Driver</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.supplierId} className="border-t border-[var(--border)]">
                    <td className="px-6 py-4 font-semibold text-[var(--text)]">{item.supplierName}</td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{item.country ?? "-"}</td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{item.tier ?? "-"}</td>
                    <td className="px-4 py-4"><RiskValue value={item.overallRiskScore} /></td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{item.operationalRiskScore.toFixed(2)}</td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{item.esgRiskScore.toFixed(2)}</td>
                    <td className="px-4 py-4"><RiskLevelBadge level={item.riskLevel} /></td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{item.primaryDriver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleItems.length ? (
              <EmptyStateWithAction
                message="No suppliers match the current table search."
                onClearFilters={onClearFilters}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function SupplierRankingCompare({
  rankings,
  isLoading,
  onClearFilters,
}: {
  rankings: SupplierRankingsResponse | undefined;
  isLoading: boolean;
  onClearFilters?: () => void;
}) {
  const groups = [
    { label: "Overall", items: rankings?.topOverallRisk ?? [], score: "overallRiskScore" as const },
    { label: "Operational", items: rankings?.topOperationalRisk ?? [], score: "operationalRiskScore" as const },
    { label: "ESG", items: rankings?.topEsgRisk ?? [], score: "esgRiskScore" as const },
    { label: "Lowest Risk", items: rankings?.lowestRisk ?? [], score: "overallRiskScore" as const },
  ];

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-4">
      {isLoading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[260px] animate-pulse rounded-[1.75rem] bg-slate-100" />
        ))
      ) : groups.every((group) => group.items.length === 0) ? (
        <div className="xl:col-span-4">
          <EmptyStateWithAction
            message="No supplier ranking comparison data matches the current filters."
            onClearFilters={onClearFilters}
          />
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="visual-card-soft p-5">
            <p className="eyebrow">{group.label}</p>
            <div className="mt-4 grid gap-3">
              {group.items.slice(0, 5).map((item, index) => (
                <div key={`${group.label}-${item.supplierId}`} className="rounded-xl border border-[var(--border)] bg-white/75 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">{index + 1}. {item.supplierName}</p>
                    <RiskValue value={item[group.score]} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.primaryDriver}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function SupplierRankingChart({
  title,
  items,
  isLoading,
  scoreKey,
  gradient,
  onClearFilters,
  reverseGradient = false,
}: {
  title: string;
  items: SupplierRankingItem[];
  isLoading: boolean;
  scoreKey: "overallRiskScore" | "operationalRiskScore" | "esgRiskScore";
  gradient: [string, string];
  onClearFilters?: () => void;
  reverseGradient?: boolean;
}) {
  const chartItems = [...items].slice(0, 8).reverse();
  const colors = reverseGradient
    ? buildGradientColors(chartItems.length, gradient[0], gradient[1])
    : buildGradientColors(chartItems.length, gradient[1], gradient[0]);

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">{title}</h3>
        <p className="visual-description">
          Ranked supplier comparison with risk score and top risk driver context.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
      ) : chartItems.length === 0 ? (
        <EmptyStateWithAction
          message="No supplier ranking data matches the current filters."
          onClearFilters={onClearFilters}
        />
      ) : (
        <PlotlyChart
          className="h-[380px]"
          data={[
            {
              type: "bar",
              orientation: "h",
              y: chartItems.map((item) => item.supplierName),
              x: chartItems.map((item) => item[scoreKey]),
              marker: {
                color: colors,
                line: {
                  color: colors,
                  width: 0.5,
                },
              },
              text: chartItems.map((item) => item[scoreKey].toFixed(2)),
              textposition: "outside",
              cliponaxis: false,
              hovertemplate:
                "Supplier Name: %{y}<br>Score: %{x}<br>Top Risk Driver: %{customdata}<extra></extra>",
              customdata: chartItems.map((item) => item.primaryDriver),
            },
          ]}
          layout={{
            margin: { l: 150, r: 26, t: 12, b: 34 },
            xaxis: {
              title: {
                text: "Risk Score",
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "#dbeafe",
              zeroline: false,
            },
            yaxis: {
              tickfont: { size: 11, color: "#64748b" },
              automargin: true,
            },
            showlegend: false,
          }}
        />
      )}
    </section>
  );
}

function EsgMonitoringAnalyticsPanel({
  suppliers,
  alerts,
  mlInsights,
  isLoading,
}: {
  suppliers: EsgWatchlistSupplier[];
  alerts: EsgAlertItem[];
  mlInsights: EsgMlInsights | undefined;
  isLoading: boolean;
}) {
  const alertCountBySupplier = new Map<number, number>();
  alerts.forEach((alert) => {
    alertCountBySupplier.set(alert.supplierId, (alertCountBySupplier.get(alert.supplierId) ?? 0) + 1);
  });
  const mlFlagged = new Set(mlInsights?.flaggedSupplierDetails.map((item) => item.supplierId) ?? []);
  const rows = [...suppliers].sort(
    (a, b) => b.esgRiskScore + b.mlAnomalyScore - (a.esgRiskScore + a.mlAnomalyScore),
  );

  return (
    <section className="mt-8 rounded-[1.75rem] border border-[var(--border)] bg-white/80 p-5">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="visual-title">ESG Monitoring Queue</h3>
          <p className="visual-description">
            Action-oriented queue using open alerts, ESG risk, ML anomaly score, and supplier exposure.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <TrendMetricPill label="Open Alerts" value={String(alerts.length)} />
          <TrendMetricPill label="ML Flagged" value={String(mlInsights?.flaggedSuppliers ?? 0)} />
          <TrendMetricPill
            label="Avg Anomaly"
            value={mlInsights ? mlInsights.averageAnomalyScore.toFixed(2) : "-"}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-56 animate-pulse rounded-3xl bg-slate-100" />
      ) : rows.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No ESG monitoring suppliers available for the current data set.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Monitoring Priority</th>
                <th>Signals</th>
                <th>Primary Gap</th>
                <th>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => {
                const alertCount = alertCountBySupplier.get(supplier.supplierId) ?? 0;
                const mlFlag = mlFlagged.has(supplier.supplierId);
                return (
                  <tr key={supplier.supplierId}>
                    <td className="min-w-[15rem]">
                      <p className="font-semibold text-[var(--text)]">{supplier.supplierName}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {supplier.country ?? "Unknown country"} | {supplier.tier ?? "No tier"}
                      </p>
                    </td>
                    <td>
                      <EsgMonitorPriorityBadge
                        value={getEsgMonitoringPriority(supplier, alertCount, mlFlag)}
                      />
                    </td>
                    <td className="min-w-[16rem]">
                      <div className="flex flex-wrap gap-2">
                        <EsgSignalChip label={`ESG ${supplier.esgRiskScore.toFixed(2)}`} tone="risk" />
                        <EsgSignalChip label={`ML ${supplier.mlAnomalyScore.toFixed(2)}`} tone="warning" />
                        <EsgSignalChip label={`${alertCount} alerts`} tone={alertCount ? "risk" : "default"} />
                        {mlFlag ? <EsgSignalChip label="ML flagged" tone="warning" /> : null}
                      </div>
                    </td>
                    <td className="min-w-[13rem]">{supplier.primaryConcern}</td>
                    <td className="min-w-[17rem] font-semibold text-[var(--text)]">
                      {supplier.recommendedAction}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {alerts.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-rose-950">{alert.supplierName}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                    {alert.indicator}
                  </p>
                </div>
                <span className="tag border-rose-200 bg-white text-rose-700">{alert.severity}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-5 text-rose-950">
                {alert.recommendedAction}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EsgSignalChip({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "risk" | "warning";
}) {
  const className =
    tone === "risk"
      ? "tag border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "tag border-amber-200 bg-amber-50 text-amber-700"
        : "tag border-[var(--border)] bg-white text-[var(--text-secondary)]";
  return <span className={className}>{label}</span>;
}

function EsgMonitorPriorityBadge({ value }: { value: string }) {
  const className =
    value === "Urgent review"
      ? "tag border-rose-200 bg-rose-50 text-rose-700"
      : value === "Watch closely"
        ? "tag border-amber-200 bg-amber-50 text-amber-700"
        : "tag tag-primary";
  return <span className={className}>{value}</span>;
}

function getEsgMonitoringPriority(
  supplier: EsgWatchlistSupplier,
  alertCount: number,
  mlFlagged: boolean,
) {
  const priorityScore =
    supplier.esgRiskScore + supplier.mlAnomalyScore + alertCount * 0.15 + (mlFlagged ? 0.25 : 0);
  if (priorityScore >= 1.65 || supplier.status.toLowerCase().includes("critical")) {
    return "Urgent review";
  }
  if (priorityScore >= 1.15 || supplier.status.toLowerCase().includes("watch")) {
    return "Watch closely";
  }
  return "Monitor";
}

function EsgPillarByCountryChart({
  items,
  isLoading,
}: {
  items: Array<{
    country: string;
    environmental: number;
    social: number;
    governance: number;
  }>;
  isLoading: boolean;
}) {
  const topItems = [...items].slice(0, 7);

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">ESG Pillars by Country</h3>
        <p className="visual-description">
          Environmental, social, and governance comparison across countries.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
      ) : topItems.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No ESG pillar analysis data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[360px]"
          data={[
            {
              type: "bar",
              name: "Environmental",
              x: topItems.map((item) => item.country),
              y: topItems.map((item) => item.environmental),
              marker: { color: "#16a34a" },
              hovertemplate: "Country Name: %{x}<br>Environmental: %{y}<extra></extra>",
            },
            {
              type: "bar",
              name: "Social",
              x: topItems.map((item) => item.country),
              y: topItems.map((item) => item.social),
              marker: { color: "#f59e0b" },
              hovertemplate: "Country Name: %{x}<br>Social: %{y}<extra></extra>",
            },
            {
              type: "bar",
              name: "Governance",
              x: topItems.map((item) => item.country),
              y: topItems.map((item) => item.governance),
              marker: { color: "#3b82f6" },
              hovertemplate: "Country Name: %{x}<br>Governance: %{y}<extra></extra>",
            },
          ]}
          layout={{
            barmode: "group",
            margin: { l: 42, r: 18, t: 12, b: 70 },
            xaxis: {
              tickangle: -25,
              tickfont: { size: 11, color: "#64748b" },
            },
            yaxis: {
              title: {
                text: "Average Pillar Score",
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "#dbeafe",
              zeroline: false,
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.12,
            },
          }}
        />
      )}
    </section>
  );
}

function TopSupplierEsgPillarChart({
  items,
  isLoading,
}: {
  items: EsgPillarSupplierItem[];
  isLoading: boolean;
}) {
  const chartItems = [...items].reverse();

  return (
    <section className="visual-card-soft rounded-[1.75rem] p-6">
      <div className="visual-header">
        <h3 className="visual-title">Top Supplier ESG Pillars</h3>
        <p className="visual-description">
          Top suppliers compared across environmental, social, and governance scores.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
      ) : chartItems.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No supplier ESG pillar data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[360px]"
          data={[
            {
              type: "bar",
              orientation: "h",
              name: "Environmental",
              y: chartItems.map((item) => item.supplierName),
              x: chartItems.map((item) => item.environmental),
              marker: { color: "#16a34a" },
              hovertemplate: "Supplier Name: %{y}<br>Environmental: %{x}<extra></extra>",
            },
            {
              type: "bar",
              orientation: "h",
              name: "Social",
              y: chartItems.map((item) => item.supplierName),
              x: chartItems.map((item) => item.social),
              marker: { color: "#f59e0b" },
              hovertemplate: "Supplier Name: %{y}<br>Social: %{x}<extra></extra>",
            },
            {
              type: "bar",
              orientation: "h",
              name: "Governance",
              y: chartItems.map((item) => item.supplierName),
              x: chartItems.map((item) => item.governance),
              marker: { color: "#3b82f6" },
              hovertemplate: "Supplier Name: %{y}<br>Governance: %{x}<extra></extra>",
            },
          ]}
          layout={{
            barmode: "group",
            margin: { l: 150, r: 18, t: 12, b: 34 },
            xaxis: {
              title: {
                text: "Pillar Score",
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "#dbeafe",
              zeroline: false,
            },
            yaxis: {
              tickfont: { size: 11, color: "#64748b" },
              automargin: true,
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.12,
            },
          }}
        />
      )}
    </section>
  );
}

function OperationalTrendChart({
  items,
  isLoading,
}: {
  items: Array<{
    period: string;
    avgDelayDays: number;
    avgDefectRatePct: number;
    avgCostVariancePct: number;
    transactionCount: number;
  }>;
  isLoading: boolean;
}) {
  const latest = items.length > 0 ? items[items.length - 1] : undefined;
  const earliest = items.length > 0 ? items[0] : undefined;
  const delayDelta =
    latest && earliest ? (latest.avgDelayDays - earliest.avgDelayDays).toFixed(2) : null;

  return (
    <section
      className="rounded-[2rem] border p-6 shadow-sm"
      style={{
        borderColor: "rgba(22, 101, 52, 0.1)",
        background:
          "linear-gradient(180deg, rgba(248, 252, 247, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)",
      }}
    >
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="visual-title">Operational Trends</h3>
          <p className="visual-description">
            Monthly trendlines for delivery delays, defect rates, and cost variance.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <TrendMetricPill
            label="Latest Delay"
            value={latest ? `${latest.avgDelayDays.toFixed(2)} d` : "-"}
          />
          <TrendMetricPill
            label="Latest Defect"
            value={latest ? `${latest.avgDefectRatePct.toFixed(2)}%` : "-"}
          />
          <TrendMetricPill
            label="Delay Shift"
            value={delayDelta ? `${Number(delayDelta) > 0 ? "+" : ""}${delayDelta} d` : "-"}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-[380px] animate-pulse rounded-3xl bg-slate-100" />
      ) : items.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No operational trend data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[380px]"
          data={[
            {
              type: "scatter",
              mode: "lines+markers",
              name: "Avg Delay Days",
              x: items.map((item) => item.period),
              y: items.map((item) => item.avgDelayDays),
              line: { color: "#166534", width: 3 },
              marker: { color: "#166534", size: 6 },
              fill: "tozeroy",
              fillcolor: "rgba(22, 101, 52, 0.08)",
              hovertemplate: "Period: %{x}<br>Avg Delay Days: %{y}<extra></extra>",
            },
            {
              type: "scatter",
              mode: "lines+markers",
              name: "Avg Defect Rate %",
              x: items.map((item) => item.period),
              y: items.map((item) => item.avgDefectRatePct),
              line: { color: "#0f766e", width: 3 },
              marker: { color: "#0f766e", size: 6 },
              hovertemplate: "Period: %{x}<br>Avg Defect Rate %: %{y}<extra></extra>",
            },
            {
              type: "scatter",
              mode: "lines+markers",
              name: "Avg Cost Variance %",
              x: items.map((item) => item.period),
              y: items.map((item) => item.avgCostVariancePct),
              line: { color: "#f59e0b", width: 3 },
              marker: { color: "#f59e0b", size: 6 },
              hovertemplate: "Period: %{x}<br>Avg Cost Variance %: %{y}<extra></extra>",
            },
          ]}
          layout={{
            hovermode: "x unified",
            margin: { l: 52, r: 16, t: 12, b: 72 },
            xaxis: {
              tickangle: -40,
              tickfont: { size: 10, color: "#64748b" },
              showgrid: false,
              tickcolor: "#cbd5e1",
              linecolor: "#d5ddd7",
            },
            yaxis: {
              title: {
                text: "Monthly Metric Value",
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "rgba(148, 163, 184, 0.22)",
              zeroline: false,
              tickcolor: "#cbd5e1",
              linecolor: "#d5ddd7",
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.14,
              bgcolor: "rgba(255,255,255,0.75)",
            },
          }}
        />
      )}
    </section>
  );
}

function MultiSeriesTrendChart({
  title,
  description,
  series,
  isLoading,
  valueLabel,
  palette,
}: {
  title: string;
  description: string;
  series: Array<{
    name: string;
    points: Array<{ period: string; value: number }>;
  }>;
  isLoading: boolean;
  valueLabel: string;
  palette: string[];
}) {
  const totalPoints = series.reduce((sum, item) => sum + item.points.length, 0);
  const allPeriods = series.flatMap((item) => item.points.map((point) => point.period)).sort();
  const latestPeriod = allPeriods.length > 0 ? allPeriods[allPeriods.length - 1] : undefined;

  return (
    <section
      className="rounded-[2rem] border p-6 shadow-sm"
      style={{
        borderColor: "rgba(71, 85, 105, 0.09)",
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.94) 100%)",
      }}
    >
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="visual-title">{title}</h3>
          <p className="visual-description">{description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TrendMetricPill label="Series" value={String(series.length)} />
          <TrendMetricPill
            label="Latest Period"
            value={latestPeriod ?? "-"}
            detail={`${totalPoints} total plotted points`}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-[380px] animate-pulse rounded-3xl bg-slate-100" />
      ) : series.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No trend comparison data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[380px]"
          data={series.map((item, index) => ({
            type: "scatter",
            mode: "lines+markers",
            name: item.name,
            x: item.points.map((point) => point.period),
            y: item.points.map((point) => point.value),
            line: { color: palette[index % palette.length], width: 3 },
            marker: {
              color: palette[index % palette.length],
              size: 6,
              line: { color: "#ffffff", width: 1.5 },
            },
            connectgaps: true,
            hovertemplate: `${title.includes("Country") ? "Country Name" : "Commodity Name"}: ${
              item.name
            }<br>Period: %{x}<br>${valueLabel}: %{y}<extra></extra>`,
          }))}
          layout={{
            hovermode: "x unified",
            margin: { l: 52, r: 16, t: 12, b: 72 },
            yaxis: {
              title: {
                text: valueLabel,
                font: { size: 12, color: "#64748b" },
              },
              showgrid: true,
              gridcolor: "rgba(148, 163, 184, 0.22)",
              zeroline: false,
              tickcolor: "#cbd5e1",
              linecolor: "#d5ddd7",
            },
            xaxis: {
              tickangle: -40,
              tickfont: { size: 10, color: "#64748b" },
              showgrid: false,
              tickcolor: "#cbd5e1",
              linecolor: "#d5ddd7",
            },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.14,
              bgcolor: "rgba(255,255,255,0.78)",
            },
          }}
        />
      )}
    </section>
  );
}

function TrendMovementPanel({
  countryMovement,
  commodityMovement,
}: {
  countryMovement: TrendMovement;
  commodityMovement: TrendMovement;
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <TrendMovementCard title="Worsening Country" movement={countryMovement.worsening} />
      <TrendMovementCard title="Improving Country" movement={countryMovement.improving} invert />
      <TrendMovementCard title="Worsening Commodity" movement={commodityMovement.worsening} />
      <TrendMovementCard title="Improving Commodity" movement={commodityMovement.improving} invert />
    </div>
  );
}

function TrendMovementCard({
  title,
  movement,
  invert = false,
}: {
  title: string;
  movement: TrendMovementItem | null;
  invert?: boolean;
}) {
  const isGood = invert && movement && movement.delta < 0;
  return (
    <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/80 px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--text)]">{movement?.name ?? "-"}</p>
      <p className={`mt-1 text-sm font-semibold ${isGood ? "text-[var(--primary)]" : "text-rose-700"}`}>
        {movement ? `${movement.delta >= 0 ? "+" : ""}${movement.delta.toFixed(2)} days` : "No movement data"}
      </p>
    </div>
  );
}

function TrendIntroMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/70 px-4 py-4 shadow-sm ring-1 ring-white/50 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function TrendMetricPill({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="metric-pill">
      <p className="metric-pill-label">{label}</p>
      <p className="metric-pill-value">{value}</p>
      {detail ? <p className="metric-pill-detail">{detail}</p> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </span>
      <select
        className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
        style={{ borderColor: "var(--border)" }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  className = "px-4 py-4",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
        onClick={onClick}
      >
        {label}
        <span className="text-[10px]">{active ? (direction === "asc" ? "up" : "down") : ""}</span>
      </button>
    </th>
  );
}

function RiskValue({ value }: { value: number }) {
  const high = value >= 70;
  const medium = value >= 40 && value < 70;
  return (
    <span
      className={
        high
          ? "tag border-rose-200 bg-rose-50 text-rose-700"
          : medium
            ? "tag border-amber-200 bg-amber-50 text-amber-700"
            : "tag tag-primary"
      }
    >
      {value.toFixed(2)}
    </span>
  );
}

function RiskLevelBadge({ level }: { level: string }) {
  return (
    <span
      className={
        level === "High"
          ? "tag border-rose-200 bg-rose-50 text-rose-700"
          : level === "Medium"
            ? "tag border-amber-200 bg-amber-50 text-amber-700"
            : "tag tag-primary"
      }
    >
      {level}
    </span>
  );
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sortItems<T>(
  items: T[],
  key: keyof T,
  direction: "asc" | "desc",
): T[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * multiplier;
    }
    return String(left ?? "").localeCompare(String(right ?? "")) * multiplier;
  });
}

function uniqueSuppliers(items: SupplierRankingItem[]): SupplierRankingItem[] {
  const byId = new Map<number, SupplierRankingItem>();
  items.forEach((item) => {
    const existing = byId.get(item.supplierId);
    if (!existing || item.overallRiskScore > existing.overallRiskScore) {
      byId.set(item.supplierId, item);
    }
  });
  return [...byId.values()];
}

type TrendMovementItem = {
  name: string;
  delta: number;
};

type TrendMovement = {
  worsening: TrendMovementItem | null;
  improving: TrendMovementItem | null;
};

function getTrendMovement(
  series: Array<{
    name: string;
    points: Array<{ period: string; value: number }>;
  }>,
): TrendMovement {
  const movements = series
    .map((item) => {
      if (item.points.length < 2) return null;
      const sorted = [...item.points].sort((a, b) => a.period.localeCompare(b.period));
      const latest = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];
      return {
        name: item.name,
        delta: latest.value - previous.value,
      };
    })
    .filter((item): item is TrendMovementItem => Boolean(item));

  if (!movements.length) {
    return { worsening: null, improving: null };
  }

  return {
    worsening: [...movements].sort((a, b) => b.delta - a.delta)[0],
    improving: [...movements].sort((a, b) => a.delta - b.delta)[0],
  };
}

function formatFilterLabel(key: string): string {
  if (key === "riskLevel") return "Risk level";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function buildEsgFindingTitle(
  items: Array<{
    country: string;
    environmental: number;
    social: number;
    governance: number;
  }>,
): string {
  if (!items.length) {
    return "ESG pillar hotspots will appear once data is available.";
  }

  const strongest = items
    .flatMap((item) => [
      { country: item.country, pillar: "environmental", value: item.environmental },
      { country: item.country, pillar: "social", value: item.social },
      { country: item.country, pillar: "governance", value: item.governance },
    ])
    .sort((a, b) => b.value - a.value)[0];

  return `${strongest.country} has the strongest ${strongest.pillar} pillar exposure at ${strongest.value.toFixed(
    2,
  )}.`;
}

function buildGradientColors(count: number, lightHex: string, darkHex: string): string[] {
  if (count <= 1) {
    return [darkHex];
  }

  const light = hexToRgb(lightHex);
  const dark = hexToRgb(darkHex);

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const red = Math.round(light.r + (dark.r - light.r) * ratio);
    const green = Math.round(light.g + (dark.g - light.g) * ratio);
    const blue = Math.round(light.b + (dark.b - light.b) * ratio);
    return `rgb(${red}, ${green}, ${blue})`;
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while loading analytics.";
}
