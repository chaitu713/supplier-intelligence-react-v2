import { useMemo, useState } from "react";

import { ApiError } from "../api/client";
import { getSuppliers, type SupplierRecord } from "../api/datasets";
import type {
  SupplierDisruptionSeverity,
  SimulatorAffectedSupplierItem,
} from "../api/simulator";
import { PlotlyChart } from "../components/common/PlotlyChart";
import { useSupplierDisruptionSimulation } from "../features/simulator/hooks/useSupplierDisruptionSimulation";
import { useQuery } from "@tanstack/react-query";

const severityOptions: Array<{
  value: SupplierDisruptionSeverity;
  label: string;
  description: string;
}> = [
  {
    value: "moderate",
    label: "Moderate",
    description: "Elevated pressure with contained spillover",
  },
  {
    value: "severe",
    label: "Severe",
    description: "Major disruption with stronger network effects",
  },
  {
    value: "unavailable",
    label: "Unavailable",
    description: "Near-complete supplier outage scenario",
  },
];

export function SimulatorPage() {
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [severity, setSeverity] = useState<SupplierDisruptionSeverity>("moderate");

  const suppliersQuery = useQuery({
    queryKey: ["datasets", "suppliers"],
    queryFn: () => getSuppliers(),
  });
  const simulation = useSupplierDisruptionSimulation();

  const suppliers = useMemo(
    () =>
      [...(suppliersQuery.data ?? [])].sort((a, b) =>
        a.supplier_name.localeCompare(b.supplier_name),
      ),
    [suppliersQuery.data],
  );
  const selectedSupplier =
    supplierId !== null
      ? suppliers.find((supplier) => supplier.supplier_id === supplierId) ?? null
      : null;

  const errorMessage = getErrorMessage(simulation.error ?? suppliersQuery.error);

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
            <p className="eyebrow text-sm">Simulator</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              Supplier disruption scenario planning for network risk and resilience
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
              Run a what-if disruption against a selected supplier and compare the
              network before and after the scenario across risk posture, band movement,
              and impacted suppliers.
            </p>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="visual-card p-8">
          <div className="visual-header">
            <h2 className="visual-title">Scenario Builder</h2>
            <p className="visual-description">
              Phase 1 starts with a supplier disruption simulator. Select one supplier,
              choose a severity, and run the scenario to measure risk movement.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="visual-card-soft p-6">
              <p className="eyebrow">Scenario</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">Supplier Disruption</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Simulates direct disruption pressure on one supplier, plus controlled
                spillover across related countries and commodity exposure groups.
              </p>

              <div className="mt-6 grid gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Supplier
                  </span>
                  <select
                    className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                    disabled={suppliersQuery.isLoading || !!suppliersQuery.error}
                    value={supplierId ?? ""}
                    onChange={(event) =>
                      setSupplierId(
                        event.target.value ? Number.parseInt(event.target.value, 10) : null,
                      )
                    }
                  >
                    <option value="">
                      {suppliersQuery.isLoading
                        ? "Loading suppliers..."
                        : suppliersQuery.error
                          ? "Unable to load suppliers"
                          : "Select supplier"}
                    </option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.supplier_id} value={supplier.supplier_id}>
                        {supplier.supplier_name}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {suppliersQuery.isLoading ? (
                      <span className="tag tag-neutral">Loading supplier list...</span>
                    ) : suppliersQuery.error ? (
                      <span className="tag tag-neutral">Supplier list unavailable</span>
                    ) : (
                      <>
                        <span className="tag tag-primary">
                          {suppliers.length} suppliers available
                        </span>
                        {suppliers.length > 0 ? (
                          <span className="text-xs text-[var(--muted)]">
                            Open the selector to choose one supplier for disruption.
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </label>

                <div className="grid gap-3 md:grid-cols-3">
                  {severityOptions.map((option) => {
                    const isActive = option.value === severity;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="rounded-[1.4rem] border px-4 py-4 text-left transition"
                        style={{
                          borderColor: isActive ? "rgba(22, 101, 52, 0.35)" : "var(--border)",
                          background: isActive
                            ? "rgba(22, 101, 52, 0.08)"
                            : "rgba(255,255,255,0.75)",
                        }}
                        onClick={() => setSeverity(option.value)}
                      >
                        <p className="text-sm font-semibold text-[var(--text)]">{option.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!supplierId || simulation.isPending}
                    onClick={() => {
                      if (!supplierId) return;
                      simulation.mutate({
                        scenarioType: "supplier_disruption",
                        supplierId,
                        severity,
                      });
                    }}
                  >
                    {simulation.isPending ? "Running Simulation..." : "Run Simulation"}
                  </button>
                  {selectedSupplier ? (
                    <span className="tag tag-neutral">
                      {selectedSupplier.supplier_name}
                      {selectedSupplier.country ? ` • ${selectedSupplier.country}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="visual-card-soft p-6">
              <p className="eyebrow">Current Focus</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">Simulation Scope</h3>
              <div className="mt-5 grid gap-3">
                <SimulatorInfoTile
                  label="Direct Impact"
                  value="Selected supplier operational and ESG stress"
                />
                <SimulatorInfoTile
                  label="Network Spillover"
                  value="Country and commodity-linked pressure propagation"
                />
                <SimulatorInfoTile
                  label="Outputs"
                  value="Before / after KPIs, band shifts, and affected suppliers"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="visual-card p-8">
          <div className="visual-header">
            <h2 className="visual-title">How This Simulation Works</h2>
            <p className="visual-description">
              Supplier Disruption is a deterministic what-if scenario built on the live
              supplier risk frame. It applies a controlled stress adjustment to one
              supplier and then measures how that shock changes the wider network.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="visual-card-soft p-6">
              <p className="eyebrow">Spillover</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                What spillover means here
              </h3>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                <p>
                  Spillover means the disruption does not affect only the selected supplier.
                  It also adds smaller pressure to related suppliers.
                </p>
                <p>In the current simulator, spillover is applied to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>suppliers in the same country</li>
                  <li>suppliers linked to the same commodities</li>
                </ul>
                <p>
                  So if one supplier is disrupted in a country like Indonesia, the
                  scenario assumes that related suppliers in the same geography or
                  commodity network may also feel some added pressure.
                </p>
              </div>
            </div>

            <div className="visual-card-soft p-6">
              <p className="eyebrow">Severity</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                What Moderate, Severe, and Unavailable do
              </h3>
              <div className="mt-4 grid gap-3">
                <SeverityDetailCard
                  label="Moderate"
                  detail="Smaller direct operational shock with light country and commodity spillover."
                />
                <SeverityDetailCard
                  label="Severe"
                  detail="Stronger direct disruption with larger ripple effects across related suppliers."
                />
                <SeverityDetailCard
                  label="Unavailable"
                  detail="Near-outage case with the strongest direct pressure and strongest spillover."
                />
              </div>
            </div>
          </div>
        </section>

        {simulation.data ? (
          <>
            <section className="visual-card p-8">
              <div className="visual-header">
                <h2 className="visual-title">Before vs After</h2>
                <p className="visual-description">
                  Network-level KPI movement after applying the disruption scenario to{" "}
                  {simulation.data.scenario.supplierName}.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SimulatorDeltaCard
                  label="High Risk Suppliers"
                  before={simulation.data.before.highRiskSuppliers}
                  after={simulation.data.after.highRiskSuppliers}
                  delta={simulation.data.deltas.highRiskSuppliers}
                />
                <SimulatorDeltaCard
                  label="Avg Overall Risk"
                  before={simulation.data.before.avgOverallRisk}
                  after={simulation.data.after.avgOverallRisk}
                  delta={simulation.data.deltas.avgOverallRisk}
                  precision={1}
                />
                <SimulatorDeltaCard
                  label="Avg Operational Risk"
                  before={simulation.data.before.avgOperationalRisk}
                  after={simulation.data.after.avgOperationalRisk}
                  delta={simulation.data.deltas.avgOperationalRisk}
                  precision={1}
                />
                <SimulatorDeltaCard
                  label="Avg ESG Risk"
                  before={simulation.data.before.avgEsgRisk}
                  after={simulation.data.after.avgEsgRisk}
                  delta={simulation.data.deltas.avgEsgRisk}
                  precision={1}
                />
                <SimulatorDeltaCard
                  label="Medium Risk Suppliers"
                  before={simulation.data.before.mediumRiskSuppliers}
                  after={simulation.data.after.mediumRiskSuppliers}
                  delta={simulation.data.deltas.mediumRiskSuppliers}
                />
                <SimulatorDeltaCard
                  label="Low Risk Suppliers"
                  before={simulation.data.before.lowRiskSuppliers}
                  after={simulation.data.after.lowRiskSuppliers}
                  delta={simulation.data.deltas.lowRiskSuppliers}
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Risk Band Movement</h2>
                  <p className="visual-description">
                    Supplier count transitions across low, medium, and high risk after simulation.
                  </p>
                </div>
                <RiskBandMovementChart items={simulation.data.riskBandMovement} />
              </div>

              <div className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Most Affected Suppliers</h2>
                  <p className="visual-description">
                    Suppliers with the strongest overall risk movement after the disruption scenario.
                  </p>
                </div>
                <AffectedSuppliersChart items={simulation.data.affectedSuppliers} />
              </div>
            </section>

            <section className="visual-card p-6">
              <div className="visual-header">
                <h2 className="visual-title">Affected Supplier Detail</h2>
                <p className="visual-description">
                  Detailed before-and-after comparison for the suppliers influenced by the scenario.
                </p>
              </div>
              <AffectedSuppliersTable items={simulation.data.affectedSuppliers} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SimulatorInfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-pill">
      <p className="metric-pill-label">{label}</p>
      <p className="metric-pill-value">{value}</p>
    </div>
  );
}

function SeverityDetailCard({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <div className="metric-pill">
      <p className="metric-pill-label">{label}</p>
      <p className="metric-pill-detail">{detail}</p>
    </div>
  );
}

function SimulatorDeltaCard({
  label,
  before,
  after,
  delta,
  precision = 0,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
  precision?: number;
}) {
  const formattedDelta =
    delta > 0 ? `+${delta.toFixed(precision)}` : delta.toFixed(precision);
  return (
    <div className="visual-card-soft p-5">
      <p className="eyebrow">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Before</p>
          <p className="mt-1 text-xl font-semibold text-[var(--text)]">
            {before.toFixed(precision)}
          </p>
        </div>
        <div className="text-center text-xs text-[var(--muted)]">to</div>
        <div className="text-right">
          <p className="text-xs text-[var(--muted)]">After</p>
          <p className="mt-1 text-xl font-semibold text-[var(--text)]">
            {after.toFixed(precision)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--primary)]">Delta: {formattedDelta}</p>
    </div>
  );
}

function RiskBandMovementChart({
  items,
}: {
  items: Array<{ fromBand: string; toBand: string; supplierCount: number }>;
}) {
  const chartItems = [...items].slice(0, 6);
  return chartItems.length ? (
    <PlotlyChart
      className="h-[320px]"
      data={[
        {
          type: "bar",
          x: chartItems.map((item) => `${item.fromBand} → ${item.toBand}`),
          y: chartItems.map((item) => item.supplierCount),
          marker: {
            color: chartItems.map((item) =>
              item.fromBand === item.toBand ? "#cbd5e1" : "#166534",
            ),
          },
          text: chartItems.map((item) => `${item.supplierCount}`),
          textposition: "outside",
          hovertemplate:
            "Movement: %{x}<br>Count of Suppliers: %{y}<extra></extra>",
        },
      ]}
      layout={{
        margin: { l: 38, r: 16, t: 12, b: 70 },
        xaxis: {
          tickangle: -25,
          tickfont: { size: 11, color: "#64748b" },
        },
        yaxis: {
          title: { text: "Suppliers", font: { size: 12, color: "#64748b" } },
          showgrid: true,
          gridcolor: "rgba(148, 163, 184, 0.2)",
          zeroline: false,
        },
        showlegend: false,
      }}
    />
  ) : (
    <div className="empty-state px-6 py-16 text-center text-sm">No movement data available.</div>
  );
}

function AffectedSuppliersChart({ items }: { items: SimulatorAffectedSupplierItem[] }) {
  const chartItems = [...items].slice(0, 8).reverse();
  return chartItems.length ? (
    <PlotlyChart
      className="h-[340px]"
      data={[
        {
          type: "bar",
          orientation: "h",
          y: chartItems.map((item) => item.supplierName),
          x: chartItems.map((item) => item.deltaOverallRisk),
          marker: {
            color: buildGradientColors(chartItems.length, "#fee2e2", "#991b1b"),
          },
          text: chartItems.map((item) => `+${item.deltaOverallRisk.toFixed(1)}`),
          textposition: "outside",
          cliponaxis: false,
          hovertemplate:
            "Supplier Name: %{y}<br>Overall Risk Delta: %{x}<extra></extra>",
        },
      ]}
      layout={{
        margin: { l: 160, r: 24, t: 12, b: 30 },
        xaxis: {
          title: { text: "Overall Risk Increase", font: { size: 12, color: "#64748b" } },
          showgrid: true,
          gridcolor: "rgba(148, 163, 184, 0.2)",
          zeroline: false,
        },
        yaxis: {
          tickfont: { size: 11, color: "#64748b" },
          automargin: true,
        },
        showlegend: false,
      }}
    />
  ) : (
    <div className="empty-state px-6 py-16 text-center text-sm">No affected suppliers found.</div>
  );
}

function AffectedSuppliersTable({ items }: { items: SimulatorAffectedSupplierItem[] }) {
  return items.length ? (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Country</th>
            <th>Before</th>
            <th>After</th>
            <th>Delta</th>
            <th>Band Shift</th>
            <th>Impact Reason</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.supplierId}>
              <td className="font-semibold text-[var(--text)]">{item.supplierName}</td>
              <td>{item.country ?? "-"}</td>
              <td>{item.beforeOverallRisk.toFixed(1)}</td>
              <td>{item.afterOverallRisk.toFixed(1)}</td>
              <td className="font-semibold text-[var(--primary)]">+{item.deltaOverallRisk.toFixed(1)}</td>
              <td>{item.beforeRiskLevel} → {item.afterRiskLevel}</td>
              <td>{item.impactReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state px-6 py-16 text-center text-sm">
      No affected supplier detail available yet.
    </div>
  );
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
  return "Something went wrong while running the simulator.";
}
