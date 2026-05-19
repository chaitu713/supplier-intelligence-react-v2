import { ApiError } from "../../../api/client";
import { PlotlyChart } from "../../../components/common/PlotlyChart";
import { KpiCard } from "../../overview-dashboard/components/KpiCard";
import { useExecutiveDashboard } from "../hooks/useExecutiveDashboard";
import { useEsgMonitoringOverview } from "../../esg-monitoring/hooks/useEsgMonitoring";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export function ExecutiveDashboardPage() {
  const executiveQuery = useExecutiveDashboard();
  const esgMonitoringQuery = useEsgMonitoringOverview();
  const errorMessage = getErrorMessage(executiveQuery.error);
  const executive = executiveQuery.data;
  const esgMonitoring = esgMonitoringQuery.data;
  const certificationTotal = executive
    ? executive.certificationHealth.valid +
      executive.certificationHealth.expiringSoon +
      executive.certificationHealth.expired
    : 0;

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <section className="page-header overflow-hidden px-8 py-8 animate-fade-in">
          <div
            className="relative rounded-[2rem] border px-6 py-6 sm:px-8"
            style={{
              borderColor: "var(--primary-muted)",
              background:
                "radial-gradient(circle at top left, rgba(111, 214, 145, 0.24), transparent 36%), linear-gradient(135deg, #f8fcf7 0%, #eef7f0 45%, #f7fbf8 100%)",
            }}
          >
            {/* Decorative SVG pattern */}
            <svg className="pointer-events-none absolute right-6 top-6 h-32 w-32 text-[var(--primary)] opacity-[0.04]" viewBox="0 0 128 128" fill="none">
              <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="64" cy="64" r="40" stroke="currentColor" strokeWidth="1" />
              <circle cx="64" cy="64" r="24" stroke="currentColor" strokeWidth="0.8" />
              <line x1="64" y1="4" x2="64" y2="124" stroke="currentColor" strokeWidth="0.6" />
              <line x1="4" y1="64" x2="124" y2="64" stroke="currentColor" strokeWidth="0.6" />
            </svg>
            <div className="relative flex flex-col gap-6">
              <div className="max-w-3xl">
                <p className="eyebrow text-sm">Executive Dashboard</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                  Network health, supplier risk, and compliance readiness at a glance
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                  A visual leadership view of supplier exposure, operating pressure, and
                  certification health.
                </p>
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6 animate-slide-up">
          <KpiCard
            label="Total Suppliers"
            value={executive ? executive.kpis.totalSuppliers.toLocaleString() : "-"}
            subtitle="Active supplier network"
            accentClassName="bg-[var(--primary)]"
          />
          <KpiCard
            label="High Risk Suppliers"
            value={executive ? executive.kpis.highRiskSuppliers.toLocaleString() : "-"}
            subtitle="Require immediate attention"
            accentClassName="bg-amber-500"
          />
          <KpiCard
            label="Avg Overall Risk"
            value={executive ? executive.kpis.avgOverallRisk.toFixed(1) : "-"}
            subtitle="Combined network exposure"
            accentClassName="bg-sky-500"
          />
          <KpiCard
            label="Avg Operational Risk"
            value={executive ? executive.kpis.avgOperationalRisk.toFixed(1) : "-"}
            subtitle="Delivery, quality, audits"
            accentClassName="bg-cyan-500"
          />
          <KpiCard
            label="Avg ESG Risk"
            value={executive ? executive.kpis.avgEsgRisk.toFixed(1) : "-"}
            subtitle="Environmental and compliance exposure"
            accentClassName="bg-teal-600"
          />
          <KpiCard
            label="Expiring / Expired Certs"
            value={
              executive ? executive.kpis.expiringOrExpiredCertifications.toLocaleString() : "-"
            }
            subtitle="Due soon or already lapsed"
            accentClassName="bg-violet-500"
          />
        </section>

        <ExecutiveEsgMonitoringPanel
          isLoading={esgMonitoringQuery.isLoading}
          openAlerts={esgMonitoring?.kpis.openEsgAlerts}
          deterioratingSuppliers={esgMonitoring?.kpis.deterioratingSuppliers}
          averageHealth={esgMonitoring?.kpis.averageEsgHealth}
          topSupplier={esgMonitoring?.watchlist?.[0]}
          topAlert={esgMonitoring?.alerts?.[0]}
        />

        <section className="grid gap-6 animate-slide-up-delay-1">
          <div className="grid gap-6 xl:grid-cols-3">
            <RiskDonutCard
              title="Operational Risk"
              description="Distribution of operational risk across delivery, quality, and audits."
              mix={executive?.operationalRiskMix}
            />
            <RiskDonutCard
              title="ESG Risk"
              description="Distribution of environmental, social, and governance risk."
              mix={executive?.esgRiskMix}
            />
            <RiskDonutCard
              title="Overall Risk"
              description="Combined risk posture across the supplier network."
              mix={executive?.riskMix}
            />
          </div>

          <div className="visual-card p-6">
            <div className="visual-header">
              <h2 className="visual-title">Supplier Footprint</h2>
              <p className="visual-description">
                Country-level supplier presence across the full network.
              </p>
            </div>
            <GeographyMap items={executive?.attention.geographicExposure ?? []} />
          </div>
        </section>

        <section className="grid items-stretch gap-6 xl:grid-cols-[0.8fr_1fr_1.1fr]">
          <div className="visual-card p-5">
            <div className="visual-header visual-header-compact min-h-[50px]">
              <h2 className="visual-title">Certification Status</h2>
              <p className="visual-description">
                Compliance readiness across valid, expiring-soon, and expired certificates.
              </p>
            </div>
            {executive ? (
              <div className="space-y-4">
                <PlotlyChart
                  className="h-[285px]"
                  data={[
                    {
                      type: "pie",
                      hole: 0.68,
                      labels: ["Valid", "Expiring Soon", "Expired"],
                      values: [
                        executive.certificationHealth.valid,
                        executive.certificationHealth.expiringSoon,
                        executive.certificationHealth.expired,
                      ],
                      marker: {
                        colors: ["#10b981", "#fbbf24", "#f43f5e"],
                      },
                      textinfo: "none",
                      sort: false,
                      direction: "clockwise",
                      hovertemplate:
                        "Certification State: %{label}<br>Count: %{value}<extra></extra>",
                    },
                  ]}
                  layout={{
                    showlegend: false,
                    margin: { l: 8, r: 8, t: 8, b: 8 },
                    annotations: [
                      {
                        text: `${certificationTotal}<br><span style="font-size:11px;color:#71816d">certificates</span>`,
                        showarrow: false,
                        font: { size: 18, color: "#1f2b20" },
                      },
                    ],
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                  }}
                />
                <div className="space-y-3">
                  <LegendRow
                    label="Valid"
                    value={executive.certificationHealth.valid}
                    tone="bg-emerald-500"
                  />
                  <LegendRow
                    label="Expiring Soon"
                    value={executive.certificationHealth.expiringSoon}
                    tone="bg-amber-400"
                  />
                  <LegendRow
                    label="Expired"
                    value={executive.certificationHealth.expired}
                    tone="bg-rose-500"
                  />
                </div>
              </div>
            ) : (
              <div className="h-36 animate-pulse rounded-3xl bg-slate-100" />
            )}
          </div>

          <div className="visual-card p-5">
            <div className="visual-header visual-header-compact min-h-[50px]">
            <h2 className="visual-title">Commodity Exposure</h2>
            <p className="visual-description">
              Supplier concentration across the most represented commodity groups.
            </p>
            </div>
            <CommodityExposureChart items={executive?.attention.commodityExposure ?? []} />
          </div>

          <div className="visual-card p-5">
            <div className="visual-header visual-header-compact min-h-[50px]">
            <h2 className="visual-title">Country Exposure</h2>
            <p className="visual-description">
              Top supplier concentration countries across the current network.
            </p>
            </div>
            <CountryExposureBarChart items={executive?.attention.geographicExposure ?? []} />
          </div>
        </section>

        <section className="visual-card p-6 animate-slide-up-delay-2">
          <div className="visual-header">
          <h2 className="visual-title">Suppliers under Review</h2>
          <p className="visual-description">
            Executive watchlist of suppliers that merit deeper follow-up in Due Diligence.
          </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {(executive?.attention.suppliersRequiringReview ?? []).map((supplier) => {
              const riskColor =
                supplier.riskLevel === "High"
                  ? { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.22)", text: "#dc2626" }
                  : supplier.riskLevel === "Medium"
                    ? { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.22)", text: "#b45309" }
                    : { bg: "rgba(22, 101, 52, 0.08)", border: "rgba(22, 101, 52, 0.18)", text: "#166534" };
              return (
              <div
                key={supplier.supplierId}
                className="group visual-card-soft flex min-h-[178px] flex-col rounded-[1rem] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
              >
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="min-h-[48px] text-sm font-semibold leading-6 text-[var(--text)]">
                      {supplier.supplierName}
                    </p>
                  </div>
                  <span
                    className="mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      background: riskColor.bg,
                      border: `1px solid ${riskColor.border}`,
                      color: riskColor.text,
                    }}
                  >
                    {supplier.riskLevel}
                  </span>
                </div>
                <p className="mt-2 min-h-[40px] text-xs leading-5 text-[var(--muted)]">
                  {supplier.reason}
                </p>
                <div className="mt-auto pt-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Overall Risk
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
                      {supplier.overallRiskScore.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function RiskDonutCard({
  title,
  description,
  mix,
}: {
  title: string;
  description: string;
  mix:
    | {
        high: number;
        medium: number;
        low: number;
      }
    | undefined;
}) {
  const total = mix ? mix.high + mix.medium + mix.low : 0;

  return (
    <div className="visual-card p-5">
      <div className="visual-header mb-3 min-h-[64px]">
        <h2 className="visual-title">{title}</h2>
        <p className="visual-description">{description}</p>
      </div>
      {mix ? (
        <>
          <PlotlyChart
            className="h-[210px]"
            data={[
              {
                type: "pie",
                hole: 0.72,
                labels: ["High", "Medium", "Low"],
                values: [mix.high, mix.medium, mix.low],
                marker: { colors: ["#ef4444", "#f59e0b", "#16a34a"] },
                textinfo: "none",
                sort: false,
                direction: "clockwise",
                hovertemplate:
                  "Risk Level: %{label}<br>Count of Suppliers: %{value}<extra></extra>",
              },
            ]}
            layout={{
              showlegend: false,
              margin: { l: 8, r: 8, t: 8, b: 8 },
              annotations: [
                {
                  text: `${total}<br><span style="font-size:11px;color:#71816d">suppliers</span>`,
                  showarrow: false,
                  font: { size: 18, color: "#1f2b20" },
                },
              ],
            }}
          />
        </>
      ) : (
        <div className="h-[220px] animate-pulse rounded-3xl bg-slate-100" />
      )}
    </div>
  );
}

function ExecutiveEsgMonitoringPanel({
  isLoading,
  openAlerts,
  deterioratingSuppliers,
  averageHealth,
  topSupplier,
  topAlert,
}: {
  isLoading: boolean;
  openAlerts: number | undefined;
  deterioratingSuppliers: number | undefined;
  averageHealth: number | undefined;
  topSupplier:
    | {
        supplierName: string;
        country: string | null;
        status: string;
        primaryConcern: string;
        recommendedAction: string;
      }
    | undefined;
  topAlert:
    | {
        supplierName: string;
        severity: string;
        indicator: string;
        recommendedAction: string;
      }
    | undefined;
}) {
  return (
    <section className="visual-card p-5 animate-slide-up-delay-1">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">ESG Monitoring</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
            ESG signals requiring leadership attention
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Snapshot of open ESG alerts, deteriorating suppliers, and the highest-priority supplier follow-up.
          </p>
        </div>
        <a className="tag tag-primary" href="/analytics#analytics-esg">
          View ESG analysis
        </a>
      </div>

      {isLoading ? (
        <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.1fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <ExecutiveEsgMetric label="Open alerts" value={openAlerts ?? 0} tone="risk" />
            <ExecutiveEsgMetric label="Deteriorating" value={deterioratingSuppliers ?? 0} tone="warning" />
            <ExecutiveEsgMetric label="Avg health" value={averageHealth?.toFixed(2) ?? "-"} />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Supplier to review first
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {topSupplier?.supplierName ?? "No supplier flagged"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {topSupplier ? `${topSupplier.country ?? "Unknown country"} | ${topSupplier.status}` : "Queue is clear"}
            </p>
            <p className="mt-3 text-sm leading-5 text-[var(--text-secondary)]">
              {topSupplier?.primaryConcern ?? "No priority ESG concern available."}
            </p>
            <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
              {topSupplier?.recommendedAction ?? "Continue routine monitoring."}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Highest open alert
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {topAlert?.supplierName ?? "No open alert"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topAlert ? <span className="tag border-rose-200 bg-rose-50 text-rose-700">{topAlert.severity}</span> : null}
              {topAlert ? <span className="tag border-amber-200 bg-amber-50 text-amber-700">{topAlert.indicator}</span> : null}
            </div>
            <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
              {topAlert?.recommendedAction ?? "No alert action pending."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ExecutiveEsgMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "risk" | "warning";
}) {
  const color =
    tone === "risk" ? "text-rose-700" : tone === "warning" ? "text-amber-700" : "text-[var(--text)]";
  return (
    <div
      className="rounded-2xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: tone === "risk" ? "rgba(239, 68, 68, 0.14)" : tone === "warning" ? "rgba(245, 158, 11, 0.14)" : "var(--border)",
        background: tone === "risk" ? "linear-gradient(180deg, #fff 0%, rgba(254,242,242,0.4) 100%)" : tone === "warning" ? "linear-gradient(180deg, #fff 0%, rgba(255,251,235,0.4) 100%)" : "linear-gradient(180deg, #fff 0%, rgba(240,253,244,0.3) 100%)",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function LegendRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${tone}`} />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="mono text-sm font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

function CountryExposureBarChart({
  items,
}: {
  items: Array<{
    country: string;
    supplierCount: number;
    riskLevel: "Stable" | "Watch" | "At Risk";
    avgOverallRisk: number;
    avgOperationalRisk: number;
    avgEsgRisk: number;
  }>;
}) {
  const topItems = [...items]
    .sort((a, b) => b.supplierCount - a.supplierCount)
    .slice(0, 5)
    .reverse();
  const colors = buildGradientColors(topItems.length, "#d7eadb", "#5b8f66");

  return items.length ? (
    <div className="mt-4">
      <PlotlyChart
        className="h-[390px]"
        data={[
          {
            type: "bar",
            orientation: "h",
            y: topItems.map((item) => item.country),
            x: topItems.map((item) => item.supplierCount),
            marker: {
              color: colors,
              line: {
                color: "#5f8f69",
                width: 1.2,
              },
            },
            text: topItems.map((item) => `${item.supplierCount}`),
            textposition: "outside",
            cliponaxis: false,
            hovertemplate:
              "Country Name: %{y}<br>Count of Suppliers: %{x}<extra></extra>",
          },
        ]}
        layout={{
          margin: { l: 78, r: 30, t: 0, b: 24 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: {
            showgrid: true,
            gridcolor: "#e5eee7",
            zeroline: false,
            tickfont: { color: "#5f6f63" },
          },
          yaxis: {
            tickfont: { color: "#243126", size: 12 },
          },
          showlegend: false,
        }}
      />
    </div>
  ) : (
    <div className="mt-5 h-[320px] animate-pulse rounded-3xl bg-slate-100" />
  );
}

function CommodityExposureChart({
  items,
}: {
  items: Array<{
    commodity: string;
    supplierCount: number;
  }>;
}) {
  const topItems = [...items].sort((a, b) => b.supplierCount - a.supplierCount).slice(0, 6);
  const colors = buildGradientColors(topItems.length, "#416b4a", "#dcecdf");

  return items.length ? (
    <div className="mt-4">
      <PlotlyChart
        className="h-[390px]"
        data={[
          {
            type: "bar",
            x: topItems.map((item) => item.commodity),
            y: topItems.map((item) => item.supplierCount),
            marker: {
              color: colors,
              line: {
                color: "#53755b",
                width: 1.1,
              },
            },
            text: topItems.map((item) => `${item.supplierCount}`),
            textposition: "outside",
            hovertemplate:
              "Commodity Name: %{x}<br>Count of Suppliers: %{y}<extra></extra>",
          },
        ]}
        layout={{
          margin: { l: 28, r: 20, t: 0, b: 44 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: {
            tickangle: -20,
            tickfont: { color: "#243126", size: 11 },
          },
          yaxis: {
            showgrid: true,
            gridcolor: "#e5eee7",
            zeroline: false,
            tickfont: { color: "#5f6f63" },
          },
          showlegend: false,
        }}
      />
    </div>
  ) : (
    <div className="mt-5 h-[320px] animate-pulse rounded-3xl bg-slate-100" />
  );
}

function buildGradientColors(count: number, darkHex: string, lightHex: string): string[] {
  if (count <= 1) {
    return [darkHex];
  }

  const dark = hexToRgb(darkHex);
  const light = hexToRgb(lightHex);

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const red = Math.round(dark.r + (light.r - dark.r) * ratio);
    const green = Math.round(dark.g + (light.g - dark.g) * ratio);
    const blue = Math.round(dark.b + (light.b - dark.b) * ratio);
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

function GeographyMap({
  items,
}: {
  items: Array<{
    country: string;
    supplierCount: number;
    riskLevel: "Stable" | "Watch" | "At Risk";
    avgOverallRisk: number;
    avgOperationalRisk: number;
    avgEsgRisk: number;
  }>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const positioned = useMemo(() => buildPositionedCountries(items), [items]);
  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: positioned.map((item) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [item.longitude, item.latitude],
        },
        properties: {
          country: item.country,
          supplierCount: item.supplierCount,
          riskLevel: item.riskLevel,
          avgOverallRisk: item.avgOverallRisk,
          avgOperationalRisk: item.avgOperationalRisk,
          avgEsgRisk: item.avgEsgRisk,
        },
      })),
    }),
    [positioned],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mapFailed) return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            basemap: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "OpenStreetMap",
            },
          },
          layers: [
            {
              id: "basemap",
              type: "raster",
              source: "basemap",
              paint: {
                "raster-opacity": 0.76,
                "raster-saturation": -0.58,
                "raster-contrast": -0.08,
              },
            },
          ],
        },
        center: [35, 18],
        zoom: 1.25,
        minZoom: 1,
        maxZoom: 4,
        attributionControl: false,
      });

      map.on("error", () => {
        setMapFailed(true);
      });

      map.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: false,
          showCompass: false,
        }),
        "top-right",
      );

      map.on("load", () => {
      map.addSource("supplier-countries", {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: "supplier-country-halo",
        type: "circle",
        source: "supplier-countries",
        paint: {
          "circle-radius": ["+", 10, ["*", ["get", "supplierCount"], 0.55]],
          "circle-color": "#ffffff",
          "circle-opacity": 0.86,
          "circle-blur": 0.05,
        },
      });

      map.addLayer({
        id: "supplier-country-bubbles",
        type: "circle",
        source: "supplier-countries",
        paint: {
          "circle-radius": ["+", 7, ["*", ["get", "supplierCount"], 0.48]],
          "circle-color": [
            "match",
            ["get", "riskLevel"],
            "At Risk",
            "#ef4444",
            "Watch",
            "#f59e0b",
            "#166534",
          ],
          "circle-opacity": 0.9,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "supplier-country-labels",
        type: "symbol",
        source: "supplier-countries",
        layout: {
          "text-field": [
            "format",
            ["get", "country"],
            { "font-scale": 1 },
            "\n",
            {},
            ["to-string", ["get", "supplierCount"]],
            { "font-scale": 0.9 },
          ],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-offset": [0, 2],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#243126",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 1.6,
        },
      });

      if (positioned.length > 0) {
        const bounds = positioned.reduce(
          (currentBounds, item) =>
            currentBounds.extend([item.longitude, item.latitude] as [number, number]),
          new maplibregl.LngLatBounds(
            [positioned[0].longitude, positioned[0].latitude],
            [positioned[0].longitude, positioned[0].latitude],
          ),
        );
        map.fitBounds(bounds, {
          padding: { top: 72, bottom: 72, left: 88, right: 88 },
          maxZoom: 2.25,
          duration: 0,
        });
      }

      map.on("mouseenter", "supplier-country-bubbles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "supplier-country-bubbles", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
      map.on("mousemove", "supplier-country-bubbles", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        const properties = feature.properties as Record<string, string | number>;

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: "map-popup",
          offset: 14,
        })
          .setLngLat(coordinates)
          .setHTML(
            `<div class="map-popup-card">
              <div class="map-popup-title">${properties.country}</div>
              <div class="map-popup-row"><span>Suppliers</span><strong>${properties.supplierCount}</strong></div>
              <div class="map-popup-row"><span>Risk</span><strong>${properties.riskLevel}</strong></div>
              <div class="map-popup-row"><span>Avg Overall</span><strong>${formatPopupNumber(properties.avgOverallRisk)}</strong></div>
              <div class="map-popup-row"><span>Operational</span><strong>${formatPopupNumber(properties.avgOperationalRisk)}</strong></div>
              <div class="map-popup-row"><span>ESG</span><strong>${formatPopupNumber(properties.avgEsgRisk)}</strong></div>
            </div>`,
          )
          .addTo(map);
      });
      });

      mapRef.current = map;
    } catch {
      setMapFailed(true);
    }

    return () => {
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geojson, mapFailed, positioned]);

  useEffect(() => {
    const source = mapRef.current?.getSource("supplier-countries") as GeoJSONSource | undefined;
    source?.setData(geojson);
  }, [geojson]);

  return (
      <div
        className="relative h-[560px] overflow-hidden rounded-[1.25rem] border"
        style={{
          borderColor: "var(--border)",
          background: "linear-gradient(180deg, #eef5f0 0%, #e5eee8 100%)",
        }}
      >
        {mapFailed ? (
          <FallbackGeoMap items={positioned} />
        ) : (
          <div ref={containerRef} className="absolute inset-0" />
        )}
        <MapRiskLegend />
    </div>
  );
}

function MapRiskLegend() {
  return (
    <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#166534]" />
        Stable
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
        Watch
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
        At Risk
      </span>
    </div>
  );
}

function formatPopupNumber(value: string | number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(1) : "-";
}

function FallbackGeoMap({
  items,
}: {
  items: Array<{
    country: string;
    supplierCount: number;
    riskLevel: "Stable" | "Watch" | "At Risk";
    longitude: number;
    latitude: number;
  }>;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#eef5f0_0%,#e5eee8_100%)]">
      <div className="absolute inset-8 rounded-[1rem] border border-[rgba(17,22,18,0.08)] bg-white/35" />
      {items.map((item) => {
        const x = ((item.longitude + 180) / 360) * 100;
        const y = ((90 - item.latitude) / 180) * 100;
        const size = Math.min(44, 22 + item.supplierCount * 0.8);
        return (
          <div
            key={item.country}
            className="absolute grid place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              background: item.riskLevel === "At Risk" ? "#ef4444" : item.riskLevel === "Watch" ? "#f59e0b" : "#166534",
            }}
            title={`${item.country}: ${item.supplierCount} suppliers`}
          >
            {item.supplierCount}
          </div>
        );
      })}
    </div>
  );
}

function buildPositionedCountries(
  items: Array<{
    country: string;
    supplierCount: number;
    riskLevel: "Stable" | "Watch" | "At Risk";
    avgOverallRisk: number;
    avgOperationalRisk: number;
    avgEsgRisk: number;
  }>,
) {
  return items
    .map((item) => {
      const position = countryMapPositions[item.country.toLowerCase()];
      if (!position) {
        return null;
      }
      return { ...item, ...position };
    })
    .filter(Boolean) as Array<{
      country: string;
      supplierCount: number;
      riskLevel: "Stable" | "Watch" | "At Risk";
      avgOverallRisk: number;
      avgOperationalRisk: number;
      avgEsgRisk: number;
      longitude: number;
      latitude: number;
    }>;
}

const countryMapPositions: Record<
  string,
  { longitude: number; latitude: number }
> = {
  usa: { longitude: -98, latitude: 39 },
  mexico: { longitude: -102, latitude: 23 },
  brazil: { longitude: -52, latitude: -10 },
  netherlands: { longitude: 5.3, latitude: 52.1 },
  france: { longitude: 2.2, latitude: 46.2 },
  germany: { longitude: 10.4, latitude: 51.1 },
  uk: { longitude: -1.5, latitude: 54.2 },
  india: { longitude: 78.9, latitude: 22.6 },
  china: { longitude: 104.2, latitude: 35.9 },
  vietnam: { longitude: 106.3, latitude: 16.1 },
  thailand: { longitude: 101, latitude: 15.8 },
  malaysia: { longitude: 102, latitude: 4.2 },
  singapore: { longitude: 103.8, latitude: 1.35 },
  indonesia: { longitude: 117, latitude: -2.5 },
  philippines: { longitude: 122.8, latitude: 12.8 },
};

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

  return "Something went wrong while loading the executive dashboard.";
}
