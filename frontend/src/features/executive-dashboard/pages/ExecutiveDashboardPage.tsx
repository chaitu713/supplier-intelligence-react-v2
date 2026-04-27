import { ApiError } from "../../../api/client";
import { PlotlyChart } from "../../../components/common/PlotlyChart";
import { KpiCard } from "../../overview-dashboard/components/KpiCard";
import { useExecutiveDashboard } from "../hooks/useExecutiveDashboard";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Sphere,
} from "react-simple-maps";
import worldAtlas from "world-atlas/countries-110m.json";

export function ExecutiveDashboardPage() {
  const executiveQuery = useExecutiveDashboard();
  const errorMessage = getErrorMessage(executiveQuery.error);
  const executive = executiveQuery.data;
  const certificationTotal = executive
    ? executive.certificationHealth.valid +
      executive.certificationHealth.expiringSoon +
      executive.certificationHealth.expired
    : 0;

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <section className="page-header overflow-hidden px-8 py-8">
          <div
            className="rounded-[2rem] border px-6 py-6 sm:px-8"
            style={{
              borderColor: "var(--primary-muted)",
              background:
                "radial-gradient(circle at top left, rgba(111, 214, 145, 0.24), transparent 36%), linear-gradient(135deg, #f8fcf7 0%, #eef7f0 45%, #f7fbf8 100%)",
            }}
          >
            <div className="flex flex-col gap-6">
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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

        <section className="grid gap-6">
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

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1fr_1.1fr]">
          <div className="visual-card p-6">
            <div className="visual-header">
              <h2 className="visual-title">Certification Status</h2>
              <p className="visual-description">
                Compliance readiness across valid, expiring-soon, and expired certificates.
              </p>
            </div>
            {executive ? (
              <div className="space-y-5">
                <PlotlyChart
                  className="h-[240px]"
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

          <div className="visual-card p-6">
            <div className="visual-header">
            <h2 className="visual-title">Commodity Exposure</h2>
            <p className="visual-description">
              Supplier concentration across the most represented commodity groups.
            </p>
            </div>
            <CommodityExposureChart items={executive?.attention.commodityExposure ?? []} />
          </div>

          <div className="visual-card p-6">
            <div className="visual-header">
            <h2 className="visual-title">Country Exposure</h2>
            <p className="visual-description">
              Top supplier concentration countries across the current network.
            </p>
            </div>
            <CountryExposureBarChart items={executive?.attention.geographicExposure ?? []} />
          </div>
        </section>

        <section className="visual-card p-6">
          <div className="visual-header">
          <h2 className="visual-title">Suppliers under Review</h2>
          <p className="visual-description">
            Executive watchlist of suppliers that merit deeper follow-up in Due Diligence.
          </p>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-5">
            {(executive?.attention.suppliersRequiringReview ?? []).map((supplier) => (
              <div key={supplier.supplierId} className="visual-card-soft rounded-[1.75rem] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold leading-6 text-[var(--text)]">
                      {supplier.supplierName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{supplier.reason}</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {supplier.riskLevel}
                  </span>
                </div>
                <div className="mt-5 flex items-end justify-between gap-4">
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
            ))}
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
    <div className="visual-card p-6">
      <div className="visual-header">
        <h2 className="visual-title">{title}</h2>
        <p className="visual-description">{description}</p>
      </div>
      {mix ? (
        <>
          <PlotlyChart
            className="h-[220px]"
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
    <div className="mt-5">
      <PlotlyChart
        className="h-[320px]"
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
          margin: { l: 80, r: 30, t: 10, b: 24 },
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
    <div className="mt-5">
      <PlotlyChart
        className="h-[320px]"
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
          margin: { l: 28, r: 20, t: 10, b: 70 },
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
  const positioned = items
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

  return (
      <div
        className="relative h-[560px] overflow-hidden rounded-[1.75rem] border"
        style={{
          borderColor: "var(--border)",
          background: "linear-gradient(180deg, #f2f7f3 0%, #e7f0ea 100%)",
        }}
      >
        <div className="absolute inset-0">
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 205 }}
            width={1000}
            height={520}
            style={{ width: "100%", height: "100%" }}
        >
          <Sphere fill="#edf7f1" stroke="#c7d9cc" strokeWidth={0.8} />
          <Geographies geography={worldAtlas}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#bfd5c4"
                  stroke="#87a18d"
                  strokeWidth={0.7}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#b0ccb7" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {positioned.map((item) => {
            const radius = Math.min(17, 6 + item.supplierCount * 0.65);
            return (
              <Marker key={item.country} coordinates={[item.longitude, item.latitude]}>
                <g>
                  <title>{`Country Name: ${item.country}\nCount of Suppliers: ${item.supplierCount}`}</title>
                  <circle r={radius + 3} fill="#ffffff" opacity={0.92} />
                  <circle r={radius} fill="#f5f8f5" stroke="#6f8475" strokeWidth={1.4} />
                  <text
                    textAnchor="middle"
                    y={4}
                    style={{
                      fontFamily: "Outfit, system-ui, sans-serif",
                      fill: "#314337",
                      fontSize: `${Math.max(8, radius * 0.8)}px`,
                      fontWeight: 700,
                      pointerEvents: "none",
                    }}
                  >
                    {item.supplierCount}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ComposableMap>
      </div>
    </div>
  );
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
