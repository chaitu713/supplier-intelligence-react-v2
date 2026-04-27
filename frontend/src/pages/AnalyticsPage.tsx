import { useState } from "react";
import { ApiError } from "../api/client";
import type {
  AnalyticsFilters,
  CommodityAnalysisItem,
  CountryAnalysisItem,
  EsgPillarSupplierItem,
  HistogramBin,
} from "../api/analytics";
import { PlotlyChart } from "../components/common/PlotlyChart";
import { useCommodityAnalysis } from "../features/analytics/hooks/useCommodityAnalysis";
import { useCountryAnalysis } from "../features/analytics/hooks/useCountryAnalysis";
import { useEsgPillarAnalysis } from "../features/analytics/hooks/useEsgPillarAnalysis";
import { useRiskDistributions } from "../features/analytics/hooks/useRiskDistributions";
import { useSupplierRankings } from "../features/analytics/hooks/useSupplierRankings";
import { useTrendAnalysis } from "../features/analytics/hooks/useTrendAnalysis";
import type { SupplierRankingItem } from "../api/analytics";

export function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const distributionsQuery = useRiskDistributions(7, filters);
  const countryAnalysisQuery = useCountryAnalysis(filters);
  const commodityAnalysisQuery = useCommodityAnalysis(filters);
  const supplierRankingsQuery = useSupplierRankings(8, filters);
  const esgPillarQuery = useEsgPillarAnalysis(filters);
  const trendAnalysisQuery = useTrendAnalysis(filters);
  const errorMessage = getErrorMessage(
    distributionsQuery.error ??
      countryAnalysisQuery.error ??
      commodityAnalysisQuery.error ??
      supplierRankingsQuery.error ??
      esgPillarQuery.error ??
      trendAnalysisQuery.error,
  );
  const distributions = distributionsQuery.data;
  const countryAnalysis = countryAnalysisQuery.data;
  const commodityAnalysis = commodityAnalysisQuery.data;
  const supplierRankings = supplierRankingsQuery.data;
  const esgPillars = esgPillarQuery.data;
  const trendAnalysis = trendAnalysisQuery.data;
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
        <header className="page-header overflow-hidden px-8 py-8">
          <div
            className="rounded-[2rem] border px-6 py-6 sm:px-8"
            style={{
              borderColor: "var(--primary-muted)",
              background:
                "radial-gradient(circle at top left, rgba(111, 214, 145, 0.18), transparent 36%), linear-gradient(135deg, #f8fcf7 0%, #f1f7f2 45%, #f9fcfa 100%)",
            }}
          >
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
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="surface-card px-8 py-6">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Filters
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
                Refine analytics across geography, commodity, tier, and risk level
              </h2>
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
                  onClick={() => setFilters({})}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card px-8 py-8">
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
              color="#166534"
            />
            <AnalyticsHistogramCard
              title="Operational Risk Distribution"
              description="Histogram-style view of delivery, quality, audit, and execution pressure."
              bins={distributions?.operational ?? []}
              isLoading={distributionsQuery.isLoading}
              color="#0f766e"
            />
            <AnalyticsHistogramCard
              title="ESG Risk Distribution"
              description="Histogram-style view of environmental, social, and governance exposure."
              bins={distributions?.esg ?? []}
              isLoading={distributionsQuery.isLoading}
              color="#7c3aed"
            />
          </div>
        </section>

        <section className="surface-card px-8 py-8">
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

          <div className="mt-8">
            <CountryRiskComparisonChart
              items={countryAnalysis?.countries ?? []}
              isLoading={countryAnalysisQuery.isLoading}
            />
          </div>

          <CountryAnalysisTable
            items={countryAnalysis?.countries ?? []}
            isLoading={countryAnalysisQuery.isLoading}
          />
        </section>

        <section className="surface-card px-8 py-8">
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
          />
        </section>

        <section className="surface-card px-8 py-8">
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

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <SupplierRankingChart
              title="Top Overall Risk Suppliers"
              items={supplierRankings?.topOverallRisk ?? []}
              isLoading={supplierRankingsQuery.isLoading}
              scoreKey="overallRiskScore"
              gradient={["#991b1b", "#fecaca"]}
            />
            <SupplierRankingChart
              title="Top Operational Risk Suppliers"
              items={supplierRankings?.topOperationalRisk ?? []}
              isLoading={supplierRankingsQuery.isLoading}
              scoreKey="operationalRiskScore"
              gradient={["#b91c1c", "#fecaca"]}
            />
            <SupplierRankingChart
              title="Top ESG Risk Suppliers"
              items={supplierRankings?.topEsgRisk ?? []}
              isLoading={supplierRankingsQuery.isLoading}
              scoreKey="esgRiskScore"
              gradient={["#7f1d1d", "#fee2e2"]}
            />
            <SupplierRankingChart
              title="Lowest Risk Suppliers"
              items={supplierRankings?.lowestRisk ?? []}
              isLoading={supplierRankingsQuery.isLoading}
              scoreKey="overallRiskScore"
              gradient={["#14532d", "#dcfce7"]}
              reverseGradient
            />
          </div>
        </section>

        <section className="surface-card px-8 py-8">
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

        <section className="surface-card px-8 py-8">
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

function AnalyticsHistogramCard({
  title,
  description,
  bins,
  isLoading,
  color,
}: {
  title: string;
  description: string;
  bins: HistogramBin[];
  isLoading: boolean;
  color: string;
}) {
  const normalizedBins = bins.map((bin) => ({
    ...bin,
    count: Number(bin.count) || 0,
  }));

  const tickValues = normalizedBins.map((bin) => (bin.start + bin.end) / 2);
  const tickText = normalizedBins.map((bin) => `${bin.start.toFixed(1)}-${bin.end.toFixed(1)}`);

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
        <div className="empty-state px-6 py-16 text-center text-sm">
          No distribution data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[340px]"
          data={[
            {
              type: "bar",
              x: tickValues,
              y: normalizedBins.map((bin) => bin.count),
              width: normalizedBins.map((bin) => Math.max(0, bin.end - bin.start)),
              marker: {
                color,
                line: { color, width: 0 },
              },
              hovertemplate: "Risk Range: %{customdata}<br>Count: %{y}<extra></extra>",
              customdata: tickText,
            },
          ]}
          layout={{
            bargap: 0,
            margin: { l: 56, r: 20, t: 8, b: 82 },
            xaxis: {
              title: {
                text: "Risk score range",
                font: { size: 12, color: "#64748b" },
                standoff: 18,
              },
              tickmode: "array",
              tickvals: tickValues,
              ticktext: tickText,
              tickangle: normalizedBins.length > 10 ? -35 : 0,
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
}: {
  items: CountryAnalysisItem[];
  isLoading: boolean;
}) {
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
        <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">
          No country analysis data available yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-6 py-4">Country</th>
                <th className="px-4 py-4">Suppliers</th>
                <th className="px-4 py-4">Avg Overall</th>
                <th className="px-4 py-4">Avg Operational</th>
                <th className="px-4 py-4">Avg ESG</th>
                <th className="px-4 py-4">Expiring</th>
                <th className="px-4 py-4">Expired</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.country} className="border-t border-[var(--border)]">
                  <td className="px-6 py-4 font-semibold text-[var(--text)]">{item.country}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">{item.supplierCount}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgOverallRisk.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgOperationalRisk.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgEsgRisk.toFixed(1)}
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
}: {
  items: CommodityAnalysisItem[];
  isLoading: boolean;
}) {
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
        <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">
          No commodity analysis data available yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-6 py-4">Commodity</th>
                <th className="px-4 py-4">Suppliers</th>
                <th className="px-4 py-4">Avg Overall</th>
                <th className="px-4 py-4">Avg Operational</th>
                <th className="px-4 py-4">Avg ESG</th>
                <th className="px-4 py-4">Deforestation</th>
                <th className="px-4 py-4">Avg Volume</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.commodity} className="border-t border-[var(--border)]">
                  <td className="px-6 py-4 font-semibold text-[var(--text)]">{item.commodity}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">{item.supplierCount}</td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgOverallRisk.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgOperationalRisk.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgEsgRisk.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.deforestationRiskScore.toFixed(3)}
                  </td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">
                    {item.avgVolume.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  reverseGradient = false,
}: {
  title: string;
  items: SupplierRankingItem[];
  isLoading: boolean;
  scoreKey: "overallRiskScore" | "operationalRiskScore" | "esgRiskScore";
  gradient: [string, string];
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
        <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">
          No supplier ranking data available yet.
        </div>
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
              text: chartItems.map((item) => item[scoreKey].toFixed(1)),
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

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
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
