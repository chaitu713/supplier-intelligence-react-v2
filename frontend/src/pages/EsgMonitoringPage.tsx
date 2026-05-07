import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type { EsgIndicatorSummary, EsgWatchlistSupplier } from "../api/esgMonitoring";
import { useEsgMonitoringOverview } from "../features/esg-monitoring/hooks/useEsgMonitoring";

const PILLARS = ["All", "Environmental", "Social", "Governance"] as const;
const COLORS = {
  healthy: "#166534",
  watch: "#d97706",
  critical: "#dc2626",
  ink: "#111612",
  muted: "#778a71",
  blue: "#2563eb",
};

export function EsgMonitoringPage() {
  const { data, isLoading, error } = useEsgMonitoringOverview();
  const [pillar, setPillar] = useState<(typeof PILLARS)[number]>("All");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  const indicators = data?.indicators ?? [];
  const watchlist = data?.watchlist ?? [];
  const selectedSupplier = watchlist.find((item) => item.supplierId === selectedSupplierId) ?? watchlist[0];

  const radarData = useMemo(() => buildRadarData(indicators), [indicators]);
  const filteredIndicators = useMemo(
    () => indicators.filter((item) => pillar === "All" || item.category.includes(pillar)),
    [indicators, pillar],
  );
  const scatterData = useMemo(
    () =>
      watchlist.map((supplier) => ({
        ...supplier,
        x: supplier.esgHealthScore,
        y: supplier.mlAnomalyScore,
        z: Math.max(90, supplier.esgRiskScore * 5),
      })),
    [watchlist],
  );
  const driverBars = selectedSupplier ? buildDriverBars(selectedSupplier) : [];

  if (error) {
    return (
      <div className="page-shell">
        <section className="empty-state px-6 py-16 text-center text-sm">
          Continuous monitoring could not load.
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <section className="page-header px-8 py-8">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.2fr] xl:items-center">
          <div>
            <p className="eyebrow">ML monitoring</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              Continuous ESG Monitoring
            </h1>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile label="Health" value={formatNumber(data?.kpis.averageEsgHealth)} tone="good" />
              <MetricTile label="Anomaly" value={formatNumber(data?.mlInsights.averageAnomalyScore)} tone="watch" />
              <MetricTile label="Deteriorating" value={data?.kpis.deterioratingSuppliers ?? "-"} tone="critical" />
              <MetricTile label="Alerts" value={data?.kpis.openEsgAlerts ?? "-"} tone="blue" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div className="visual-card-soft rounded-[8px] p-5">
              <HealthRing value={data?.kpis.averageEsgHealth ?? 0} loading={isLoading} />
            </div>
            <div className="visual-card-soft rounded-[8px] p-4">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(17,22,18,0.12)" />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                  <Radar dataKey="risk" stroke={COLORS.critical} fill={COLORS.critical} fillOpacity={0.22} />
                  <Radar dataKey="health" stroke={COLORS.healthy} fill={COLORS.healthy} fillOpacity={0.16} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
        <div className="visual-card p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="visual-title">Supplier Anomaly Field</h2>
              <p className="visual-description mt-1">Health vs active risk pressure</p>
            </div>
            <span className="tag tag-accent">{data?.mlInsights.flaggedSuppliers ?? 0} ML flags</span>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
              <CartesianGrid stroke="rgba(17,22,18,0.08)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Health"
                domain={[0, 100]}
                tick={{ fill: COLORS.muted, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Anomaly"
                domain={[0, 100]}
                tick={{ fill: COLORS.muted, fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[80, 520]} />
              <Tooltip content={<SupplierTooltip />} />
              <Scatter
                data={scatterData}
                dataKey="y"
                onClick={(point) => {
                  const supplierId = Number((point as unknown as { supplierId?: number }).supplierId);
                  if (Number.isFinite(supplierId)) {
                    setSelectedSupplierId(supplierId);
                  }
                }}
              >
                {scatterData.map((entry) => (
                  <Cell key={entry.supplierId} fill={supplierColor(entry)} fillOpacity={0.82} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="visual-card p-6">
          <h2 className="visual-title">AI Alert Stream</h2>
          <div className="mt-5 space-y-3">
            {(data?.alerts ?? []).slice(0, 6).map((alert) => (
              <button
                key={alert.id}
                type="button"
                className="w-full rounded-[8px] border border-[var(--border)] bg-white/80 p-4 text-left shadow-[var(--shadow-xs)]"
                onClick={() => setSelectedSupplierId(alert.supplierId)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{alert.supplierName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{alert.indicator}</p>
                  </div>
                  <span className={alert.severity === "Critical" ? "tag tag-primary" : "tag tag-accent"}>
                    {alert.severity}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div className="h-full w-4/5 rounded-full bg-[var(--primary)]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="visual-card p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="visual-title">ESG Attribute Heatmap</h2>
              <p className="visual-description mt-1">All available indicators</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PILLARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={pillar === item ? "tag tag-primary" : "tag tag-neutral"}
                  onClick={() => setPillar(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredIndicators.map((item) => (
              <HeatTile key={item.key} item={item} />
            ))}
          </div>
        </div>

        <div className="visual-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="visual-title">{selectedSupplier?.supplierName ?? "Supplier Focus"}</h2>
              <p className="visual-description mt-1">
                {selectedSupplier?.country ?? "Unknown"} | {selectedSupplier?.tier ?? "No tier"}
              </p>
            </div>
            <span className="tag tag-primary">{selectedSupplier?.primaryConcern ?? "Monitor"}</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={driverBars} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 18 }}>
              <CartesianGrid stroke="rgba(17,22,18,0.08)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={72} tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 7, 7, 0]}>
                {driverBars.map((bar) => (
                  <Cell key={bar.label} fill={bar.value >= 75 ? COLORS.critical : bar.value >= 60 ? COLORS.watch : COLORS.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat label="ESG Risk" value={formatNumber(selectedSupplier?.esgRiskScore)} />
            <MiniStat label="Health" value={formatNumber(selectedSupplier?.esgHealthScore)} />
            <MiniStat label="Anomaly" value={formatNumber(selectedSupplier?.mlAnomalyScore)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {watchlist.slice(0, 8).map((supplier) => (
          <SupplierCard
            key={supplier.supplierId}
            supplier={supplier}
            active={supplier.supplierId === selectedSupplier?.supplierId}
            onSelect={() => setSelectedSupplierId(supplier.supplierId)}
          />
        ))}
      </section>
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string | number; tone: "good" | "watch" | "critical" | "blue" }) {
  const color = tone === "good" ? COLORS.healthy : tone === "watch" ? COLORS.watch : tone === "critical" ? COLORS.critical : COLORS.blue;
  return (
    <div className="metric-pill">
      <div className="metric-pill-label">{label}</div>
      <div className="metric-pill-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function HealthRing({ value, loading }: { value: number; loading: boolean }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="grid place-items-center">
      <div
        className="grid h-40 w-40 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${COLORS.healthy} ${clamped * 3.6}deg, #e2e5e1 0deg)`,
        }}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full bg-white">
          <div className="text-center">
            <div className="text-3xl font-semibold text-[var(--text)]">{loading ? "-" : clamped.toFixed(1)}</div>
            <div className="metric-pill-label">ESG health</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatTile({ item }: { item: EsgIndicatorSummary }) {
  const risk = Math.min(100, Math.max(0, item.averageRisk));
  return (
    <div
      className="min-h-[86px] rounded-[8px] border p-3"
      style={{
        borderColor: "rgba(17,22,18,0.08)",
        background: `color-mix(in srgb, ${riskColor(risk)} ${Math.max(16, risk * 0.72)}%, white)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
        <div className="text-sm font-semibold text-[var(--text)]">{risk.toFixed(0)}</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/65">
        <div className="h-full rounded-full" style={{ width: `${risk}%`, background: riskColor(risk) }} />
      </div>
      <div className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">
        {item.highRiskSuppliers} high-risk
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  active,
  onSelect,
}: {
  supplier: EsgWatchlistSupplier;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="visual-card-soft rounded-[8px] p-4 text-left transition hover:-translate-y-0.5"
      style={{ borderColor: active ? "var(--primary-muted)" : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{supplier.supplierName}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{supplier.country ?? "Unknown"}</p>
        </div>
        <span className={supplier.trend === "Deteriorating" ? "tag tag-primary" : "tag tag-neutral"}>
          {supplier.trend}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <DriverPip label="BWS" value={supplier.bwsRisk} />
        <DriverPip label="HRR" value={supplier.hrrRisk} />
        <DriverPip label="Land" value={supplier.landUseRisk} />
      </div>
    </button>
  );
}

function DriverPip({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-3)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: riskColor(value) }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-white/80 p-3">
      <div className="metric-pill-label">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

function SupplierTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: EsgWatchlistSupplier }> }) {
  if (!active || !payload?.length) return null;
  const supplier = payload[0].payload;
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-sm)]">
      <div className="text-sm font-semibold text-[var(--text)]">{supplier.supplierName}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">Health {supplier.esgHealthScore.toFixed(1)}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">Anomaly {supplier.mlAnomalyScore.toFixed(1)}</div>
    </div>
  );
}

function buildRadarData(indicators: EsgIndicatorSummary[]) {
  const groups = ["Environmental", "Social", "Governance"].map((pillar) => {
    const items = indicators.filter((item) => item.category.includes(pillar));
    const risk = items.length ? items.reduce((sum, item) => sum + item.averageRisk, 0) / items.length : 0;
    return { pillar, risk: Number(risk.toFixed(1)), health: Number((100 - risk).toFixed(1)) };
  });
  return [
    ...groups,
    {
      pillar: "Priority",
      risk: Number(
        (indicators.filter((item) => item.isPriority).reduce((sum, item) => sum + item.averageRisk, 0) /
          Math.max(1, indicators.filter((item) => item.isPriority).length)).toFixed(1),
      ),
      health: 0,
    },
  ].map((item) => ({ ...item, health: item.health || Number((100 - item.risk).toFixed(1)) }));
}

function buildDriverBars(supplier: EsgWatchlistSupplier) {
  return [
    { label: "ESG", value: supplier.esgRiskScore },
    { label: "BWS", value: supplier.bwsRisk },
    { label: "HRR", value: supplier.hrrRisk },
    { label: "Land", value: supplier.landUseRisk },
  ].sort((a, b) => b.value - a.value);
}

function supplierColor(supplier: EsgWatchlistSupplier) {
  if (supplier.trend === "Deteriorating" || supplier.esgRiskScore >= 75) return COLORS.critical;
  if (supplier.esgRiskScore >= 60) return COLORS.watch;
  return COLORS.healthy;
}

function riskColor(value: number) {
  if (value >= 75) return COLORS.critical;
  if (value >= 60) return COLORS.watch;
  return COLORS.healthy;
}

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toFixed(1) : "-";
}
