import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../api/client";
import type {
  EsgAlertItem,
  EsgIndicatorSummary,
  EsgMlInsights,
  EsgWatchlistSupplier,
} from "../api/esgMonitoring";
import { useEsgMonitoringOverview } from "../features/esg-monitoring/hooks/useEsgMonitoring";

const ESG_PILLARS = ["Environmental", "Social", "Governance"] as const;
type EsgPillar = (typeof ESG_PILLARS)[number];

export function EsgMonitoringPage() {
  const [activePillar, setActivePillar] = useState<EsgPillar>("Environmental");
  const overviewQuery = useEsgMonitoringOverview();
  const overview = overviewQuery.data;
  const errorMessage = getErrorMessage(overviewQuery.error);
  const pillarIndicators = useMemo(
    () => getPillarIndicators(overview?.indicators ?? [], activePillar),
    [activePillar, overview?.indicators],
  );
  const pillarAlerts = useMemo(
    () => getPillarAlerts(overview?.alerts ?? [], activePillar),
    [activePillar, overview?.alerts],
  );
  const pillarSummary = getPillarSummary(activePillar, pillarIndicators);

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header px-8 py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow text-sm">ESG Monitoring</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                Continuous ESG indicator monitoring
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                Track BWS, HRR, and land-use pressure across suppliers, surface
                deterioration signals, and route high-concern suppliers into due diligence.
              </p>
            </div>
            <div className="surface-soft grid gap-3 p-4 sm:grid-cols-3 xl:w-[460px]">
              {overview?.healthTrends.map((trend) => (
                <div key={trend.label} className="surface-subtle px-4 py-3">
                  <p className="text-xs font-medium text-[var(--muted)]">{trend.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
                    {trend.supplierCount}
                  </p>
                </div>
              ))}
              {overviewQuery.isLoading ? <HeaderSkeleton /> : null}
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {overviewQuery.isLoading ? (
          <LoadingState />
        ) : overview ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Suppliers Monitored" value={overview.kpis.totalSuppliers} />
              <KpiCard label="High ESG Risk" value={overview.kpis.highEsgRiskSuppliers} tone="risk" />
              <KpiCard label="Deteriorating" value={overview.kpis.deterioratingSuppliers} tone="warning" />
              <KpiCard label="Open ESG Alerts" value={overview.kpis.openEsgAlerts} tone="risk" />
              <KpiCard
                label="Avg ESG Health"
                value={`${overview.kpis.averageEsgHealth.toFixed(1)}%`}
                tone="success"
              />
            </section>

            <section className="flex flex-col gap-6">
              <div className="visual-card p-6">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="visual-header mb-0">
                      <h2 className="visual-title">Indicator Management</h2>
                      <p className="visual-description">
                        Review ESG parameters by pillar, with compliance and assurance signals separated from core performance indicators.
                      </p>
                    </div>
                    <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
                      {ESG_PILLARS.map((pillar) => (
                        <button
                          key={pillar}
                          type="button"
                          onClick={() => setActivePillar(pillar)}
                          className={
                            activePillar === pillar
                              ? "rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[var(--primary)] shadow-[var(--shadow-xs)]"
                              : "rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                          }
                        >
                          {pillar}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4">
                    <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
                      <div>
                        <p className="eyebrow">{activePillar} Focus</p>
                        <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">
                          {pillarSummary.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          {pillarSummary.description}
                        </p>
                      </div>
                      <div className="grid min-w-[360px] gap-3 sm:grid-cols-3">
                        <SummaryTile label="Avg Risk" value={pillarSummary.averageRisk.toFixed(1)} />
                        <SummaryTile label="High Risk" value={pillarSummary.highRiskSuppliers} tone="risk" />
                        <SummaryTile label="Parameters" value={pillarIndicators.length} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {pillarIndicators
                      .filter((indicator) => isCorePillarCategory(indicator.category, activePillar))
                      .map((indicator) => (
                        <ParameterCard key={indicator.key} indicator={indicator} />
                      ))}
                  </div>

                  <div className="grid items-start gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="eyebrow">Compliance Signals</p>
                        <span className="tag tag-neutral">
                          {pillarIndicators.filter((indicator) => !isCorePillarCategory(indicator.category, activePillar)).length} signals
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {pillarIndicators
                          .filter((indicator) => !isCorePillarCategory(indicator.category, activePillar))
                          .map((indicator) => (
                            <SignalRow key={indicator.key} indicator={indicator} />
                          ))}
                        {pillarIndicators.filter((indicator) => !isCorePillarCategory(indicator.category, activePillar)).length === 0 ? (
                          <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--muted)]">
                            No separate compliance signals for this pillar.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="eyebrow">Monitoring Rules</p>
                        <span className="tag tag-accent">Rule based</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <RuleBlock label="Watch" threshold="40-59" detail="Track movement" />
                        <RuleBlock label="High" threshold="60-74" detail="Open follow-up" />
                        <RuleBlock label="Critical" threshold="75+" detail="Due diligence" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <MlMonitoringPanel insights={overview.mlInsights} />

              <div className="visual-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="visual-header mb-0">
                    <h2 className="visual-title">ESG Alert Feed</h2>
                    <p className="visual-description">
                      Highest-priority supplier alerts filtered for {activePillar.toLowerCase()} review.
                    </p>
                  </div>
                  <span className="tag tag-neutral">{pillarAlerts.length} active alerts</span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {pillarAlerts.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}
                  {pillarAlerts.length === 0 ? (
                    <div className="empty-state px-4 py-6 text-sm">
                      No {activePillar.toLowerCase()} alerts are open.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="visual-card overflow-hidden p-6">
              <div className="visual-header">
                <h2 className="visual-title">Supplier ESG Watchlist</h2>
                <p className="visual-description">
                  Suppliers ranked by composite ESG risk, BWS, HRR, and land-use pressure.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1120px]">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Location</th>
                      <th>ESG Health</th>
                      <th>BWS</th>
                      <th>HRR</th>
                      <th>Land Use</th>
                      <th>Trend</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.watchlist.map((supplier) => (
                      <WatchlistRow key={supplier.supplierId} supplier={supplier} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "risk" | "warning" | "success";
}) {
  const toneClass = {
    neutral: "text-[var(--text)]",
    risk: "text-rose-700",
    warning: "text-amber-700",
    success: "text-[var(--primary)]",
  }[tone];

  return (
    <div className="visual-card-soft p-5">
      <p className="muted-eyebrow">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "risk";
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className={tone === "risk" ? "mt-1 text-xl font-semibold text-rose-700" : "mt-1 text-xl font-semibold text-[var(--text)]"}>
        {value}
      </p>
    </div>
  );
}

function ParameterCard({ indicator }: { indicator: EsgIndicatorSummary }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{indicator.label}</p>
          <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
            {indicator.description}
          </p>
        </div>
        <span className={indicator.trend === "Watch" ? "tag bg-amber-50 text-amber-700" : "tag tag-primary"}>
          {indicator.trend}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-[var(--muted)]">Average risk</span>
          <span className="text-xl font-semibold text-[var(--text)]">
            {indicator.averageRisk.toFixed(1)}
          </span>
        </div>
        <RiskBar value={indicator.averageRisk} />
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        {indicator.highRiskSuppliers} suppliers above threshold
      </p>
    </div>
  );
}

function SignalRow({ indicator }: { indicator: EsgIndicatorSummary }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{indicator.label}</p>
        <p className="text-xs leading-4 text-[var(--muted)]">{indicator.description}</p>
      </div>
      <p className="shrink-0 rounded-lg bg-white px-3 py-1 text-sm font-semibold text-[var(--primary)] shadow-[var(--shadow-xs)]">
        {indicator.averageRisk.toFixed(1)}
      </p>
    </div>
  );
}

function MlMonitoringPanel({ insights }: { insights: EsgMlInsights }) {
  return (
    <div className="visual-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="visual-header mb-0">
          <h2 className="visual-title">ML ESG Health Signals</h2>
          <p className="visual-description">
            Unsupervised anomaly detection over supplier ESG, audit, alert, certification, country, and commodity features.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="tag tag-accent">{insights.modelName}</span>
          <span className="tag tag-neutral">{insights.monitoringMode}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <SummaryTile label="Flagged" value={insights.flaggedSuppliers} tone="risk" />
          <SummaryTile label="Avg Anomaly" value={insights.averageAnomalyScore.toFixed(1)} />
          <SummaryTile label="Mode" value="Snapshot" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4">
            <p className="eyebrow">Flagged Suppliers</p>
            <div className="mt-4 space-y-3">
              {insights.flaggedSupplierDetails.map((supplier) => (
                <div
                  key={supplier.supplierId}
                  className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-2)] px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{supplier.supplierName}</p>
                    <p className="text-xs leading-4 text-[var(--muted)]">{supplier.signal}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-rose-700">
                      {supplier.anomalyScore.toFixed(1)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {(supplier.confidence * 100).toFixed(0)}% conf.
                    </p>
                  </div>
                </div>
              ))}
              {insights.flaggedSupplierDetails.length === 0 ? (
                <p className="rounded-xl bg-[var(--surface-2)] px-3 py-4 text-sm text-[var(--muted)]">
                  No suppliers are flagged by the current ML snapshot.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4">
            <p className="eyebrow">Model Notes</p>
            <div className="mt-4 space-y-3">
              {[...insights.topSignals, ...insights.dataLimitations].map((note) => (
                <div key={note} className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
                  <p className="text-sm leading-5 text-[var(--text-secondary)]">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleBlock({
  label,
  threshold,
  detail,
}: {
  label: string;
  threshold: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
      <p className="text-xs font-semibold text-[var(--text)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--primary)]">{threshold}</p>
      <p className="mt-1 text-xs leading-4 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function AlertRow({ alert }: { alert: EsgAlertItem }) {
  return (
    <div className="surface-subtle px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={alert.severity === "Critical" ? "tag bg-rose-50 text-rose-700" : "tag bg-amber-50 text-amber-700"}>
          {alert.severity}
        </span>
        <span className="tag tag-neutral">{alert.indicator}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--text)]">{alert.supplierName}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{alert.message}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{alert.recommendedAction}</p>
    </div>
  );
}

function WatchlistRow({ supplier }: { supplier: EsgWatchlistSupplier }) {
  return (
    <tr>
      <td>
        <div>
          <p className="font-semibold text-[var(--text)]">{supplier.supplierName}</p>
          <p className="text-xs text-[var(--muted)]">{supplier.primaryConcern}</p>
        </div>
      </td>
      <td>
        {supplier.country ?? "Unknown"}
        <span className="ml-2 text-xs text-[var(--muted)]">{supplier.tier ?? ""}</span>
      </td>
      <td>
        <div className="min-w-32">
          <div className="flex items-center justify-between gap-3">
            <span>{supplier.esgHealthScore.toFixed(1)}%</span>
            <span className="text-xs text-[var(--muted)]">
              Risk {supplier.esgRiskScore.toFixed(1)}
            </span>
          </div>
          <RiskBar value={100 - supplier.esgHealthScore} />
        </div>
      </td>
      <td>{supplier.bwsRisk.toFixed(1)}</td>
      <td>{supplier.hrrRisk.toFixed(1)}</td>
      <td>{supplier.landUseRisk.toFixed(1)}</td>
      <td>
        <span className={getTrendClass(supplier.trend)}>{supplier.trend}</span>
      </td>
      <td>
        <span className={getStatusClass(supplier.status)}>{supplier.status}</span>
      </td>
      <td>
        <div className="flex max-w-xs flex-col gap-2">
          <span className="text-xs leading-5 text-[var(--muted)]">{supplier.recommendedAction}</span>
          <Link className="btn-primary min-h-9 px-3 text-xs" to="/due-diligence-agent">
            Review
          </Link>
        </div>
      </td>
    </tr>
  );
}

function RiskBar({ value }: { value: number }) {
  const boundedValue = Math.max(0, Math.min(100, value));
  const barColor =
    boundedValue >= 70 ? "#be123c" : boundedValue >= 50 ? "#d97706" : "var(--primary)";

  return (
    <div className="mt-2 h-2 rounded-full bg-slate-200">
      <div
        className="h-2 rounded-full"
        style={{ width: `${boundedValue}%`, background: barColor }}
      />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="surface-subtle h-20 animate-pulse bg-white/70" />
      ))}
    </>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="visual-card-soft h-36 animate-pulse" />
      ))}
    </div>
  );
}

function getTrendClass(trend: string) {
  if (trend === "Deteriorating") {
    return "tag bg-rose-50 text-rose-700";
  }
  if (trend === "Improving") {
    return "tag tag-primary";
  }
  return "tag tag-neutral";
}

function getStatusClass(status: string) {
  if (status === "Action Required") {
    return "tag bg-rose-50 text-rose-700";
  }
  if (status === "Watch") {
    return "tag bg-amber-50 text-amber-700";
  }
  return "tag tag-primary";
}

function getPillarIndicators(indicators: EsgIndicatorSummary[], pillar: EsgPillar) {
  return indicators.filter((indicator) => indicator.category.startsWith(pillar));
}

function getPillarAlerts(alerts: EsgAlertItem[], pillar: EsgPillar) {
  const indicatorMap: Record<EsgPillar, string[]> = {
    Environmental: ["BWS", "Land Use", "ESG"],
    Social: ["HRR", "ESG"],
    Governance: ["ESG"],
  };
  return alerts.filter((alert) => indicatorMap[pillar].includes(alert.indicator));
}

function isCorePillarCategory(category: string, pillar: EsgPillar) {
  return category === pillar;
}

function getPillarSummary(pillar: EsgPillar, indicators: EsgIndicatorSummary[]) {
  const averageRisk =
    indicators.length > 0
      ? indicators.reduce((total, indicator) => total + indicator.averageRisk, 0) / indicators.length
      : 0;
  const highRiskSuppliers = indicators.reduce(
    (total, indicator) => total + indicator.highRiskSuppliers,
    0,
  );
  const copy: Record<EsgPillar, { title: string; description: string }> = {
    Environmental: {
      title: "Environmental pressure and resource exposure",
      description:
        "Monitor carbon, energy, water, waste, pollution, land-use, and deforestation indicators, with fines handled as environmental compliance evidence.",
    },
    Social: {
      title: "Workforce, labor, and human-rights risk",
      description:
        "Track HRR, labor, safety, workforce stability, wage, working-hours, and worker sentiment signals, with audits and complaints separated as assurance evidence.",
    },
    Governance: {
      title: "Control maturity and disclosure quality",
      description:
        "Review corruption, compliance, board oversight, transparency, disclosure, data, policy, and reporting maturity, with legal and tax exposure separated as compliance signals.",
    },
  };

  return {
    ...copy[pillar],
    averageRisk,
    highRiskSuppliers,
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

  return "Something went wrong while loading ESG monitoring.";
}
