import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import type { AdvisorSimulatorContext } from "../api/advisor";
import { ApiError } from "../api/client";
import { getSuppliers } from "../api/datasets";
import {
  getSimulatorOptions,
  runSimulation,
  type OperationalTargetType,
  type ScenarioType,
  type SimulatorAffectedSupplierItem,
  type SimulatorScenarioRequest,
  type SimulatorScenarioResponse,
  type SupplierDisruptionSeverity,
} from "../api/simulator";
import { PlotlyChart } from "../components/common/PlotlyChart";
import { useRunSimulation } from "../features/simulator/hooks/useRunSimulation";

const disruptionSeverityOptions: Array<{
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

const scenarioOptions: Array<{
  value: SimulatorMode;
  label: string;
  description: string;
  bestFor: string;
  marker: string;
}> = [
  {
    value: "supplier_disruption",
    label: "Supplier Disruption",
    description: "Stress one supplier and observe direct and spillover impact.",
    bestFor: "Single-source continuity planning",
    marker: "S",
  },
  {
    value: "country_disruption",
    label: "Country Disruption",
    description: "Stress one sourcing country and observe direct and commodity-linked impact.",
    bestFor: "Geopolitical or regional exposure",
    marker: "C",
  },
  {
    value: "commodity_shock",
    label: "Commodity Shock",
    description: "Stress one commodity and observe direct supplier and country-linked impact.",
    bestFor: "Material scarcity and price pressure",
    marker: "M",
  },
  {
    value: "operational_deterioration",
    label: "Operational Deterioration",
    description: "Increase delay, defect, and cost pressure for a target scope.",
    bestFor: "Service-level and quality degradation",
    marker: "O",
  },
  {
    value: "scenario_compare",
    label: "Scenario Compare",
    description: "Run two scenarios side by side and compare which one creates the larger impact.",
    bestFor: "Prioritizing mitigation options",
    marker: "A/B",
  },
];

const targetTypeOptions: Array<{
  value: OperationalTargetType;
  label: string;
  description: string;
}> = [
  {
    value: "supplier",
    label: "Supplier",
    description: "Apply deterioration to one selected supplier.",
  },
  {
    value: "country",
    label: "Country",
    description: "Apply deterioration across all suppliers in one country.",
  },
  {
    value: "commodity",
    label: "Commodity",
    description: "Apply deterioration across suppliers mapped to one commodity.",
  },
];

type SimulatorMode = ScenarioType | "scenario_compare";

type CompareScenarioConfig = {
  scenarioType: ScenarioType;
  supplierId: number | null;
  severity: SupplierDisruptionSeverity;
  targetType: OperationalTargetType;
  targetValue: string;
  delayIncreasePct: number;
  defectIncreasePct: number;
  costVarianceIncreasePct: number;
};

export function SimulatorPage() {
  const navigate = useNavigate();
  const [scenarioType, setScenarioType] = useState<SimulatorMode>("supplier_disruption");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [severity, setSeverity] = useState<SupplierDisruptionSeverity>("moderate");
  const [targetType, setTargetType] = useState<OperationalTargetType>("supplier");
  const [targetValue, setTargetValue] = useState<string>("");
  const [delayIncreasePct, setDelayIncreasePct] = useState<number>(20);
  const [defectIncreasePct, setDefectIncreasePct] = useState<number>(15);
  const [costVarianceIncreasePct, setCostVarianceIncreasePct] = useState<number>(10);
  const [compareA, setCompareA] = useState<CompareScenarioConfig>({
    scenarioType: "supplier_disruption",
    supplierId: null,
    severity: "moderate",
    targetType: "supplier",
    targetValue: "",
    delayIncreasePct: 20,
    defectIncreasePct: 15,
    costVarianceIncreasePct: 10,
  });
  const [compareB, setCompareB] = useState<CompareScenarioConfig>({
    scenarioType: "country_disruption",
    supplierId: null,
    severity: "severe",
    targetType: "country",
    targetValue: "",
    delayIncreasePct: 20,
    defectIncreasePct: 15,
    costVarianceIncreasePct: 10,
  });
  const [compareData, setCompareData] = useState<{
    left: SimulatorScenarioResponse;
    right: SimulatorScenarioResponse;
  } | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isCompareRunning, setIsCompareRunning] = useState(false);

  const suppliersQuery = useQuery({
    queryKey: ["datasets", "suppliers"],
    queryFn: () => getSuppliers(),
  });
  const optionsQuery = useQuery({
    queryKey: ["simulator", "options"],
    queryFn: () => getSimulatorOptions(),
  });
  const simulation = useRunSimulation();

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

  const countryOptions = optionsQuery.data?.countries ?? [];
  const commodityOptions = optionsQuery.data?.commodities ?? [];
  const targetOptions = useMemo(() => {
    if (targetType === "supplier") {
      return suppliers.map((supplier) => ({
        label: supplier.supplier_name,
        value: String(supplier.supplier_id),
      }));
    }
    if (targetType === "country") {
      return countryOptions;
    }
    return commodityOptions;
  }, [commodityOptions, countryOptions, suppliers, targetType]);

  const selectedTargetLabel = useMemo(() => {
    if (!targetValue) return null;
    const matched = targetOptions.find((option) => option.value === targetValue);
    return matched?.label ?? targetValue;
  }, [targetOptions, targetValue]);

  const compareTargetOptions = (config: CompareScenarioConfig) => {
    if (config.scenarioType === "supplier_disruption") {
      return suppliers.map((supplier) => ({
        label: supplier.supplier_name,
        value: String(supplier.supplier_id),
      }));
    }
    if (config.scenarioType === "country_disruption") {
      return countryOptions;
    }
    if (config.scenarioType === "commodity_shock") {
      return commodityOptions;
    }
    if (config.targetType === "supplier") {
      return suppliers.map((supplier) => ({
        label: supplier.supplier_name,
        value: String(supplier.supplier_id),
      }));
    }
    if (config.targetType === "country") {
      return countryOptions;
    }
    return commodityOptions;
  };

  const errorMessage = compareError ?? getErrorMessage(
    simulation.error ?? suppliersQuery.error ?? optionsQuery.error,
  );

  const canRunDisruption = !!supplierId;
  const canRunCountryDisruption = !!targetValue;
  const canRunCommodityShock = !!targetValue;
  const canRunOperational =
    !!targetValue &&
    (delayIncreasePct > 0 || defectIncreasePct > 0 || costVarianceIncreasePct > 0);
  const canRunCompare =
    isScenarioConfigRunnable(compareA) &&
    isScenarioConfigRunnable(compareB) &&
    !isCompareRunning;
  const selectedScenarioOption =
    scenarioOptions.find((option) => option.value === scenarioType) ?? scenarioOptions[0];
  const currentScenarioReady =
    scenarioType === "scenario_compare"
      ? canRunCompare
      : scenarioType === "supplier_disruption"
        ? canRunDisruption
        : scenarioType === "country_disruption"
          ? canRunCountryDisruption
          : scenarioType === "commodity_shock"
            ? canRunCommodityShock
            : canRunOperational;
  const currentRunLabel =
    scenarioType === "scenario_compare"
      ? isCompareRunning
        ? "Running Comparison..."
        : "Run Comparison"
      : simulation.isPending
        ? "Running Simulation..."
        : "Run Simulation";
  const currentMissingInput = getMissingInputMessage({
    scenarioType,
    supplierId,
    targetValue,
    compareA,
    compareB,
    delayIncreasePct,
    defectIncreasePct,
    costVarianceIncreasePct,
  });
  const currentScenarioPreview = buildScenarioPreview({
    scenarioType,
    selectedScenarioLabel: selectedScenarioOption.label,
    selectedSupplierName: selectedSupplier?.supplier_name ?? null,
    selectedTargetLabel,
    severity,
    targetType,
    delayIncreasePct,
    defectIncreasePct,
    costVarianceIncreasePct,
  });
  const impactScopeBreakdown = useMemo(() => {
    if (!simulation.data) return [];
    const buckets = new Map<string, { label: string; count: number; delta: number; color: string }>();
    const classify = (reason: string) => {
      if (reason.toLowerCase().includes("direct")) {
        return { key: "direct", label: "Direct Impact", color: "#166534" };
      }
      if (reason.toLowerCase().includes("country")) {
        return { key: "country", label: "Country Spillover", color: "#f59e0b" };
      }
      if (reason.toLowerCase().includes("commodity")) {
        return { key: "commodity", label: "Commodity Spillover", color: "#dc2626" };
      }
      return { key: "other", label: "Other Impact", color: "#64748b" };
    };
    simulation.data.affectedSuppliers.forEach((item) => {
      const info = classify(item.impactReason);
      const existing = buckets.get(info.key) ?? {
        label: info.label,
        count: 0,
        delta: 0,
        color: info.color,
      };
      existing.count += 1;
      existing.delta += item.deltaOverallRisk;
      buckets.set(info.key, existing);
    });
    return [...buckets.values()];
  }, [simulation.data]);

  async function handleRunCompare() {
    setCompareError(null);
    setCompareData(null);
    setIsCompareRunning(true);
    try {
      const [left, right] = await Promise.all([
        runSimulation(buildScenarioPayload(compareA)),
        runSimulation(buildScenarioPayload(compareB)),
      ]);
      setCompareData({ left, right });
    } catch (error) {
      setCompareError(getErrorMessage(error) ?? "Unable to run scenario comparison.");
    } finally {
      setIsCompareRunning(false);
    }
  }

  const openAdvisorForScenario = (data: SimulatorScenarioResponse) => {
    navigate("/advisor-ai", {
      state: {
        lens: "simulator",
        initialPrompt: "Explain this simulator result and tell me what changed, why it changed, and which suppliers were impacted most.",
        simulatorContext: buildAdvisorSimulatorContext(data),
      },
    });
  };

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
            {/* Decorative pattern */}
            <svg className="pointer-events-none absolute right-6 top-6 h-28 w-28 text-[var(--primary)] opacity-[0.04]" viewBox="0 0 112 112" fill="none">
              <path d="M56 8v96M8 56h96" stroke="currentColor" strokeWidth="0.8" />
              <circle cx="56" cy="56" r="44" stroke="currentColor" strokeWidth="1" />
              <circle cx="56" cy="56" r="28" stroke="currentColor" strokeWidth="0.8" />
              <path d="M56 56L84 28M56 56L28 84" stroke="currentColor" strokeWidth="0.6" />
            </svg>
            <div className="relative">
              <p className="eyebrow text-sm">Simulator</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                Scenario planning for supplier, country, commodity, and operational disruption
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                Run what-if simulations against the supplier network and compare before
                versus after outcomes across risk posture, band movement, and impacted suppliers.
              </p>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="visual-card p-8 animate-slide-up">
          <div className="visual-header">
            <h2 className="visual-title">Scenario Builder</h2>
            <p className="visual-description">
              Choose a simulator mode, configure the inputs, and run the scenario to
              measure how the network changes before and after the shock.
            </p>
          </div>

          <WorkflowSteps
            activeStep={simulation.data || compareData ? 3 : currentScenarioReady ? 2 : 1}
          />

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {scenarioOptions.map((option) => {
              const isActive = option.value === scenarioType;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="min-h-[148px] rounded-[1.15rem] border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
                  style={{
                    background: isActive
                      ? "linear-gradient(180deg, rgba(240,253,244,0.98), rgba(255,255,255,0.96))"
                      : "rgba(255,255,255,0.72)",
                    borderColor: isActive ? "rgba(22, 101, 52, 0.36)" : "var(--border)",
                    boxShadow: isActive ? "0 8px 24px rgba(22, 101, 52, 0.1)" : "none",
                  }}
                  onClick={() => {
                    setScenarioType(option.value);
                    setTargetValue("");
                    setSupplierId(null);
                    setCompareError(null);
                  }}
                >
                  <span
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold"
                    style={{
                      background: isActive ? "var(--primary)" : "var(--surface-2)",
                      color: isActive ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {option.marker}
                  </span>
                  <span className="mt-4 block text-sm font-semibold text-[var(--text)]">
                    {option.label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[var(--text-secondary)]">
                    {option.description}
                  </span>
                  <span className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {option.bestFor}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-[1.6rem] border bg-[rgba(243,247,244,0.55)] px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              {selectedScenarioOption.description}
            </p>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="visual-card-soft p-6">
              {scenarioType === "scenario_compare" ? (
                <>
                  <p className="eyebrow">Scenario</p>
                  <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                    Scenario Compare
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Configure two independent simulator runs and compare which scenario creates
                    the larger network impact.
                  </p>

                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    <CompareScenarioBuilder
                      title="Scenario A"
                      config={compareA}
                      suppliers={suppliers}
                      countries={countryOptions}
                      commodities={commodityOptions}
                      onChange={setCompareA}
                      loading={suppliersQuery.isLoading || optionsQuery.isLoading}
                    />
                    <CompareScenarioBuilder
                      title="Scenario B"
                      config={compareB}
                      suppliers={suppliers}
                      countries={countryOptions}
                      commodities={commodityOptions}
                      onChange={setCompareB}
                      loading={suppliersQuery.isLoading || optionsQuery.isLoading}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="tag tag-neutral">
                      Compare scenario impact side by side
                    </span>
                  </div>
                </>
              ) : scenarioType === "supplier_disruption" ? (
                <>
                  <p className="eyebrow">Scenario</p>
                  <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                    Supplier Disruption
                  </h3>
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
                            event.target.value
                              ? Number.parseInt(event.target.value, 10)
                              : null,
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
                            <span className="text-xs text-[var(--muted)]">
                              Open the selector to choose one supplier for disruption.
                            </span>
                          </>
                        )}
                      </div>
                    </label>

                    <div className="grid gap-3 md:grid-cols-3">
                      {disruptionSeverityOptions.map((option) => {
                        const isActive = option.value === severity;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="rounded-[1.4rem] border px-4 py-4 text-left transition"
                            style={{
                              borderColor: isActive
                                ? "rgba(22, 101, 52, 0.35)"
                                : "var(--border)",
                              background: isActive
                                ? "rgba(22, 101, 52, 0.08)"
                                : "rgba(255,255,255,0.75)",
                            }}
                            onClick={() => setSeverity(option.value)}
                          >
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selectedSupplier ? (
                        <span className="tag tag-neutral">
                          {selectedSupplier.supplier_name}
                          {selectedSupplier.country
                            ? ` | ${selectedSupplier.country}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : scenarioType === "country_disruption" ? (
                <>
                  <p className="eyebrow">Scenario</p>
                  <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                    Country Disruption
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Simulates disruption across one sourcing country and adds spillover through
                    commodity-linked supplier exposure outside that geography.
                  </p>

                  <div className="mt-6 grid gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                        Country
                      </span>
                      <select
                        className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                        style={{ borderColor: "var(--border)" }}
                        disabled={optionsQuery.isLoading || !!optionsQuery.error}
                        value={targetValue}
                        onChange={(event) => setTargetValue(event.target.value)}
                      >
                        <option value="">
                          {optionsQuery.isLoading
                            ? "Loading countries..."
                            : optionsQuery.error
                              ? "Unable to load countries"
                              : "Select country"}
                        </option>
                        {countryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3 md:grid-cols-3">
                      {disruptionSeverityOptions.map((option) => {
                        const isActive = option.value === severity;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="rounded-[1.4rem] border px-4 py-4 text-left transition"
                            style={{
                              borderColor: isActive
                                ? "rgba(22, 101, 52, 0.35)"
                                : "var(--border)",
                              background: isActive
                                ? "rgba(22, 101, 52, 0.08)"
                                : "rgba(255,255,255,0.75)",
                            }}
                            onClick={() => setSeverity(option.value)}
                          >
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selectedTargetLabel ? (
                        <span className="tag tag-neutral">{selectedTargetLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : scenarioType === "commodity_shock" ? (
                <>
                  <p className="eyebrow">Scenario</p>
                  <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                    Commodity Shock
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Simulates disruption in one commodity and applies direct pressure to the mapped
                    supplier base, with lighter spillover into related countries.
                  </p>

                  <div className="mt-6 grid gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                        Commodity
                      </span>
                      <select
                        className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                        style={{ borderColor: "var(--border)" }}
                        disabled={optionsQuery.isLoading || !!optionsQuery.error}
                        value={targetValue}
                        onChange={(event) => setTargetValue(event.target.value)}
                      >
                        <option value="">
                          {optionsQuery.isLoading
                            ? "Loading commodities..."
                            : optionsQuery.error
                              ? "Unable to load commodities"
                              : "Select commodity"}
                        </option>
                        {commodityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3 md:grid-cols-3">
                      {disruptionSeverityOptions.map((option) => {
                        const isActive = option.value === severity;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="rounded-[1.4rem] border px-4 py-4 text-left transition"
                            style={{
                              borderColor: isActive
                                ? "rgba(22, 101, 52, 0.35)"
                                : "var(--border)",
                              background: isActive
                                ? "rgba(22, 101, 52, 0.08)"
                                : "rgba(255,255,255,0.75)",
                            }}
                            onClick={() => setSeverity(option.value)}
                          >
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selectedTargetLabel ? (
                        <span className="tag tag-neutral">{selectedTargetLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="eyebrow">Scenario</p>
                  <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                    Operational Deterioration
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Simulates worsening delivery delay, defect rate, and cost variance
                    for a supplier, country, or commodity group and measures the risk shift.
                  </p>

                  <div className="mt-6 grid gap-5">
                    <div className="grid gap-3 md:grid-cols-3">
                      {targetTypeOptions.map((option) => {
                        const isActive = option.value === targetType;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="rounded-[1.4rem] border px-4 py-4 text-left transition"
                            style={{
                              borderColor: isActive
                                ? "rgba(22, 101, 52, 0.35)"
                                : "var(--border)",
                              background: isActive
                                ? "rgba(22, 101, 52, 0.08)"
                                : "rgba(255,255,255,0.75)",
                            }}
                            onClick={() => {
                              setTargetType(option.value);
                              setTargetValue("");
                            }}
                          >
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                        {targetType === "supplier"
                          ? "Supplier"
                          : targetType === "country"
                            ? "Country"
                            : "Commodity"}
                      </span>
                      <select
                        className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                        style={{ borderColor: "var(--border)" }}
                        disabled={
                          (targetType === "supplier" && (suppliersQuery.isLoading || !!suppliersQuery.error)) ||
                          (targetType !== "supplier" && (optionsQuery.isLoading || !!optionsQuery.error))
                        }
                        value={targetValue}
                        onChange={(event) => setTargetValue(event.target.value)}
                      >
                        <option value="">
                          {targetType === "supplier"
                            ? suppliersQuery.isLoading
                              ? "Loading suppliers..."
                              : "Select supplier"
                            : optionsQuery.isLoading
                              ? "Loading options..."
                              : `Select ${targetType}`}
                        </option>
                        {targetOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-3">
                      <PercentageInput
                        label="Delay Increase"
                        value={delayIncreasePct}
                        onChange={setDelayIncreasePct}
                      />
                      <PercentageInput
                        label="Defect Increase"
                        value={defectIncreasePct}
                        onChange={setDefectIncreasePct}
                      />
                      <PercentageInput
                        label="Cost Variance Increase"
                        value={costVarianceIncreasePct}
                        onChange={setCostVarianceIncreasePct}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selectedTargetLabel ? (
                        <span className="tag tag-neutral">
                          {targetType}: {selectedTargetLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="visual-card-soft p-6">
              <p className="eyebrow">Current Focus</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                Simulation Scope
              </h3>
              <div className="mt-5 grid gap-3">
                {scenarioType === "scenario_compare" ? (
                  <>
                    <SimulatorInfoTile
                      label="Comparison Mode"
                      value="Run two scenarios side by side"
                    />
                    <SimulatorInfoTile
                      label="Decision Lens"
                      value="See which scenario creates the larger risk impact"
                    />
                    <SimulatorInfoTile
                      label="Outputs"
                      value="Scenario winner, KPI deltas, and side-by-side composition"
                    />
                  </>
                ) : scenarioType === "supplier_disruption" ? (
                  <>
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
                  </>
                ) : scenarioType === "country_disruption" ? (
                  <>
                    <SimulatorInfoTile
                      label="Direct Impact"
                      value="Country-wide operational and ESG stress"
                    />
                    <SimulatorInfoTile
                      label="Network Spillover"
                      value="Commodity-linked pressure across related suppliers"
                    />
                    <SimulatorInfoTile
                      label="Outputs"
                      value="Before / after KPIs, band shifts, and impacted suppliers"
                    />
                  </>
                ) : scenarioType === "commodity_shock" ? (
                  <>
                    <SimulatorInfoTile
                      label="Direct Impact"
                      value="Commodity-mapped supplier network pressure"
                    />
                    <SimulatorInfoTile
                      label="Network Spillover"
                      value="Related country pressure across the impacted footprint"
                    />
                    <SimulatorInfoTile
                      label="Outputs"
                      value="Before / after KPIs, band shifts, and impacted suppliers"
                    />
                  </>
                ) : (
                  <>
                    <SimulatorInfoTile
                      label="Target Scope"
                      value="Supplier, country, or commodity deterioration"
                    />
                    <SimulatorInfoTile
                      label="Operational Inputs"
                      value="Delay, defect, and cost variance deterioration"
                    />
                    <SimulatorInfoTile
                      label="Outputs"
                      value="Direct target impact, related spillover, movement across bands, and affected suppliers"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-4 z-10 mt-6 rounded-[1.35rem] border border-[var(--border)] bg-white/95 px-5 py-4 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Ready Check
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: currentScenarioReady ? "#16a34a" : "#f59e0b",
                      boxShadow: currentScenarioReady
                        ? "0 0 0 3px rgba(22, 163, 74, 0.16)"
                        : "0 0 0 3px rgba(245, 158, 11, 0.16)",
                    }}
                  />
                  {currentScenarioReady ? currentScenarioPreview : currentMissingInput}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary w-full lg:w-auto"
                disabled={!currentScenarioReady || simulation.isPending || isCompareRunning}
                onClick={() => {
                  if (scenarioType === "scenario_compare") {
                    void handleRunCompare();
                    return;
                  }
                  if (scenarioType === "supplier_disruption" && supplierId) {
                    simulation.mutate({
                      scenarioType: "supplier_disruption",
                      supplierId,
                      severity,
                    });
                    return;
                  }
                  if (scenarioType === "country_disruption" && targetValue) {
                    simulation.mutate({
                      scenarioType: "country_disruption",
                      targetValue,
                      severity,
                    });
                    return;
                  }
                  if (scenarioType === "commodity_shock" && targetValue) {
                    simulation.mutate({
                      scenarioType: "commodity_shock",
                      targetValue,
                      severity,
                    });
                    return;
                  }
                  if (scenarioType === "operational_deterioration" && targetValue) {
                    simulation.mutate({
                      scenarioType: "operational_deterioration",
                      targetType,
                      targetValue,
                      delayIncreasePct,
                      defectIncreasePct,
                      costVarianceIncreasePct,
                    });
                  }
                }}
              >
                {currentRunLabel}
              </button>
            </div>
          </div>
        </section>

        <section className="visual-card p-8">
          <div className="visual-header">
            <h2 className="visual-title">How This Simulation Works</h2>
            <p className="visual-description">
              {scenarioType === "supplier_disruption"
                ? "Supplier Disruption is a deterministic what-if scenario built on the live supplier risk frame. It applies a controlled stress adjustment to one supplier and then measures how that shock changes the wider network."
                : scenarioType === "country_disruption"
                  ? "Country Disruption applies direct pressure across one sourcing country and then measures how that stress changes the wider supplier network, including commodity-linked spillover outside the selected geography."
                  : scenarioType === "commodity_shock"
                    ? "Commodity Shock applies direct pressure across suppliers mapped to one commodity and then measures how that stress changes related country exposure and portfolio risk."
                    : scenarioType === "scenario_compare"
                      ? "Scenario Compare runs two complete simulator scenarios independently and then compares the results side by side. It helps decision-makers see which disruption case creates the larger network impact."
                : "Operational Deterioration applies a controlled worsening in operational conditions and then measures how that deterioration changes supplier and network risk. It focuses mainly on operational risk, with a small ESG uplift where the deterioration is direct."}
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="visual-card-soft p-6">
              <p className="eyebrow">
                {scenarioType === "operational_deterioration" ? "Operational Inputs" : "Spillover"}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                {scenarioType === "operational_deterioration"
                  ? "What the deterioration inputs mean"
                  : scenarioType === "supplier_disruption"
                  ? "What spillover means here"
                  : "What country disruption spillover means"}
              </h3>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                {scenarioType === "scenario_compare" ? (
                  <>
                    <p>
                      Each side of the comparison runs through the same simulator engine used everywhere else.
                    </p>
                    <p>
                      This means you can compare supplier, country, commodity, and operational scenarios on a common before-versus-after basis.
                    </p>
                    <p>
                      The goal is not just to ask what happens, but to ask which scenario is worse and where you should focus mitigation first.
                    </p>
                  </>
                ) : scenarioType === "supplier_disruption" ? (
                  <>
                    <p>
                      Spillover means the disruption does not affect only the selected
                      supplier. It also adds smaller pressure to related suppliers.
                    </p>
                    <p>In the current simulator, spillover is applied to:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>suppliers in the same country</li>
                      <li>suppliers linked to the same commodities</li>
                    </ul>
                    <p>
                      So if one supplier is disrupted in a country like Indonesia, the
                      scenario assumes related suppliers in the same geography or
                      commodity network may also feel added pressure.
                    </p>
                  </>
                ) : scenarioType === "country_disruption" ? (
                  <>
                    <p>
                      Country disruption applies direct pressure to all suppliers located in the selected country.
                    </p>
                    <p>
                      It also adds smaller spillover to suppliers outside that country when they share commodities
                      with the disrupted geography.
                    </p>
                    <p>
                      This models a sourcing-country shock that can travel through shared commodity exposure.
                    </p>
                  </>
                ) : scenarioType === "commodity_shock" ? (
                  <>
                    <p>
                      Commodity shock applies direct pressure to suppliers mapped to the selected commodity.
                    </p>
                    <p>
                      It also adds lighter spillover to related countries when those countries host suppliers in the disrupted commodity network.
                    </p>
                    <p>
                      This models commodity-specific disruption such as scarcity, regulatory pressure, or sourcing instability.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Delay increase represents worsening delivery reliability and lead time pressure.
                    </p>
                    <p>
                      Defect increase represents worsening quality performance and rejection pressure.
                    </p>
                    <p>
                      Cost variance increase represents worsening commercial stability and execution variance.
                    </p>
                    <p>
                      The simulator converts those percentage deteriorations into an operational risk uplift
                      for the chosen target scope.
                    </p>
                    <p>
                      In the current version, supplier-target operational deterioration also adds light
                      spillover to related suppliers through shared country and commodity exposure.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="visual-card-soft p-6">
              <p className="eyebrow">
                {scenarioType === "operational_deterioration" ? "Target Scope" : "Severity"}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text)]">
                {scenarioType === "operational_deterioration"
                  ? "How target scope changes the impact"
                  : scenarioType === "supplier_disruption"
                  ? "What Moderate, Severe, and Unavailable do"
                  : "How Moderate, Severe, and Unavailable behave"}
              </h3>
              <div className="mt-4 grid gap-3">
                {scenarioType === "scenario_compare" ? (
                  <>
                    <SeverityDetailCard
                      label="Scenario A"
                      detail="First scenario path you want to test."
                    />
                    <SeverityDetailCard
                      label="Scenario B"
                      detail="Second scenario path you want to compare against."
                    />
                    <SeverityDetailCard
                      label="Comparison"
                      detail="Highlights which scenario creates the larger KPI and portfolio shift."
                    />
                  </>
                ) : scenarioType === "supplier_disruption" ? (
                  <>
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
                  </>
                ) : scenarioType === "country_disruption" ? (
                  <>
                    <SeverityDetailCard
                      label="Moderate"
                      detail="Smaller country-wide shock with light commodity spillover."
                    />
                    <SeverityDetailCard
                      label="Severe"
                      detail="Stronger country disruption with broader network impact."
                    />
                    <SeverityDetailCard
                      label="Unavailable"
                      detail="Near-country-outage case with the strongest direct and commodity-linked pressure."
                    />
                  </>
                ) : scenarioType === "commodity_shock" ? (
                  <>
                    <SeverityDetailCard
                      label="Moderate"
                      detail="Smaller commodity shock with light country-linked spillover."
                    />
                    <SeverityDetailCard
                      label="Severe"
                      detail="Stronger commodity disruption with wider supplier and country pressure."
                    />
                    <SeverityDetailCard
                      label="Unavailable"
                      detail="Near-supply-outage case for the selected commodity with the strongest spillover."
                    />
                  </>
                ) : (
                  <>
                    <SeverityDetailCard
                      label="Supplier"
                      detail="Applies deterioration to one selected supplier with light country and commodity spillover."
                    />
                    <SeverityDetailCard
                      label="Country"
                      detail="Applies deterioration directly across all suppliers in one selected country."
                    />
                    <SeverityDetailCard
                      label="Commodity"
                      detail="Applies deterioration directly across all suppliers mapped to one selected commodity."
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {compareData ? (
          <>
            <section
              className="visual-card overflow-hidden p-8"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(111, 214, 145, 0.18), transparent 30%), linear-gradient(135deg, #f8fcf7 0%, #f1f7f2 45%, #f9fcfa 100%)",
              }}
            >
              <div className="visual-header">
                <h2 className="visual-title">Scenario Compare Summary</h2>
                <p className="visual-description">
                  {buildComparisonHeadline(compareData.left, compareData.right)}
                </p>
              </div>
              <ComparisonWinnerPanel left={compareData.left} right={compareData.right} />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <ComparisonScenarioCard title="Scenario A" data={compareData.left} />
              <ComparisonScenarioCard title="Scenario B" data={compareData.right} />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Risk Composition Comparison</h2>
                  <p className="visual-description">
                    Compare before versus after portfolio composition for both scenarios.
                  </p>
                </div>
                <ComparisonCompositionChart left={compareData.left} right={compareData.right} />
              </div>
              <div className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">KPI Delta Comparison</h2>
                  <p className="visual-description">
                    Compare which scenario drives the larger KPI movement.
                  </p>
                </div>
                <ComparisonDeltaChart left={compareData.left} right={compareData.right} />
              </div>
            </section>
          </>
        ) : simulation.data ? (
          <>
            <section
              className="visual-card overflow-hidden p-8"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(111, 214, 145, 0.18), transparent 30%), linear-gradient(135deg, #f8fcf7 0%, #f1f7f2 45%, #f9fcfa 100%)",
              }}
            >
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
                <div>
                  <p className="eyebrow">Scenario Summary</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)]">
                    {buildScenarioHeadline(simulation.data)}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                    {simulation.data.scenario.summary}
                  </p>
                  <div className="mt-5">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => openAdvisorForScenario(simulation.data)}
                    >
                      Ask Advisor to Explain This Scenario
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <SummaryMetric
                    label="High Risk Delta"
                    value={formatDelta(simulation.data.deltas.highRiskSuppliers, 0)}
                  />
                  <SummaryMetric
                    label="Overall Risk Delta"
                    value={formatDelta(simulation.data.deltas.avgOverallRisk, 2)}
                  />
                  <SummaryMetric
                    label="Suppliers Affected"
                    value={`${simulation.data.affectedSuppliers.length}`}
                  />
                </div>
              </div>
              <DecisionSummary data={simulation.data} />
            </section>

            <section className="visual-card p-8">
              <div className="visual-header">
                <h2 className="visual-title">Before vs After</h2>
                <p className="visual-description">{simulation.data.scenario.summary}</p>
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
                  precision={2}
                />
                <SimulatorDeltaCard
                  label="Avg Operational Risk"
                  before={simulation.data.before.avgOperationalRisk}
                  after={simulation.data.after.avgOperationalRisk}
                  delta={simulation.data.deltas.avgOperationalRisk}
                  precision={2}
                />
                <SimulatorDeltaCard
                  label="Avg ESG Risk"
                  before={simulation.data.before.avgEsgRisk}
                  after={simulation.data.after.avgEsgRisk}
                  delta={simulation.data.deltas.avgEsgRisk}
                  precision={2}
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

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Risk Composition Shift</h2>
                  <p className="visual-description">
                    Before and after portfolio composition across low, medium, and high risk suppliers.
                  </p>
                </div>
                <RiskCompositionChart
                  before={simulation.data.before}
                  after={simulation.data.after}
                />
              </div>

              <div className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Impact Delta</h2>
                  <p className="visual-description">
                    Net change across the key simulator KPIs after the selected scenario.
                  </p>
                </div>
                <ImpactDeltaChart deltas={simulation.data.deltas} />
              </div>
            </section>

            {simulation.data.scenario.scenarioType === "supplier_disruption" ? (
              <section className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Impact Scope Split</h2>
                  <p className="visual-description">
                    Visual split of direct supplier impact versus country and commodity spillover.
                  </p>
                </div>
                <ImpactScopeSplitChart items={impactScopeBreakdown} />
              </section>
            ) : simulation.data.scenario.scenarioType === "country_disruption" ? (
              <section className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Country Impact Summary</h2>
                  <p className="visual-description">
                    Direct country impact and related commodity-linked spillover for the selected geography.
                  </p>
                </div>
                <CountryImpactSummary
                  country={simulation.data.scenario.country ?? simulation.data.scenario.targetValue ?? "Selected country"}
                  severity={simulation.data.scenario.severity ?? "moderate"}
                  items={impactScopeBreakdown}
                />
              </section>
            ) : simulation.data.scenario.scenarioType === "commodity_shock" ? (
              <section className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Commodity Impact Summary</h2>
                  <p className="visual-description">
                    Direct commodity impact and related country spillover for the selected commodity network.
                  </p>
                </div>
                <CommodityImpactSummary
                  commodity={simulation.data.scenario.targetValue ?? "Selected commodity"}
                  severity={simulation.data.scenario.severity ?? "moderate"}
                  items={impactScopeBreakdown}
                />
              </section>
            ) : (
              <section className="visual-card p-6">
                <div className="visual-header">
                  <h2 className="visual-title">Operational Input Meters</h2>
                  <p className="visual-description">
                    Visual summary of the deterioration inputs applied in this scenario.
                  </p>
                </div>
                <OperationalInputMeters
                  delay={simulation.data.scenario.delayIncreasePct ?? 0}
                  defect={simulation.data.scenario.defectIncreasePct ?? 0}
                  cost={simulation.data.scenario.costVarianceIncreasePct ?? 0}
                />
              </section>
            )}

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
                    Suppliers with the strongest overall risk movement after the scenario.
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
        ) : (
          <section className="visual-card p-8">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
              <div>
                <p className="eyebrow">No Simulation Run Yet</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
                  Configure a scenario to see portfolio impact, supplier movement, and recommended next steps.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  Results will summarize high-risk movement first, then show before-after composition,
                  impact deltas, affected suppliers, and the detailed supplier table.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryMetric label="Primary Answer" value="Risk shift" />
                <SummaryMetric label="Impact View" value="Supplier list" />
                <SummaryMetric label="Decision Aid" value="Advisor handoff" />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function WorkflowSteps({ activeStep }: { activeStep: number }) {
  const steps = ["Choose scenario", "Configure inputs", "Review impact"];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === activeStep;
        const isComplete = stepNumber < activeStep;
        return (
          <div
            key={step}
            className="flex items-center gap-3 rounded-[1rem] border px-4 py-3 transition-all duration-200"
            style={{
              borderColor: isComplete
                ? "rgba(22, 163, 74, 0.28)"
                : isActive
                  ? "rgba(22, 101, 52, 0.28)"
                  : "var(--border)",
              background: isComplete
                ? "rgba(240, 253, 244, 0.9)"
                : isActive
                  ? "rgba(240, 253, 244, 0.72)"
                  : "rgba(255,255,255,0.68)",
              boxShadow: isActive
                ? "0 2px 8px rgba(22, 101, 52, 0.06)"
                : "none",
            }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                background: isComplete
                  ? "#16a34a"
                  : isActive
                    ? "var(--primary)"
                    : "var(--surface-2)",
                color: isActive || isComplete ? "#fff" : "var(--muted)",
              }}
            >
              {isComplete ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : (
                stepNumber
              )}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-[var(--text)]">{step}</span>
              {isActive && (
                <span
                  className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
                  style={{ animation: "live-dot 1.5s ease-in-out infinite" }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PercentageInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </span>
      <div className="rounded-[1.4rem] border bg-white px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            className="w-full accent-[var(--primary)]"
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <span className="min-w-[3rem] text-right text-sm font-semibold text-[var(--text)]">
            {value}%
          </span>
        </div>
      </div>
    </label>
  );
}

function DecisionSummary({ data }: { data: SimulatorScenarioResponse }) {
  const topSupplier = [...data.affectedSuppliers].sort(
    (a, b) => b.deltaOverallRisk - a.deltaOverallRisk,
  )[0];
  const movedToHigh = data.riskBandMovement
    .filter((item) => item.toBand === "High" && item.fromBand !== "High")
    .reduce((total, item) => total + item.supplierCount, 0);
  const action =
    movedToHigh > 0
      ? "Prioritize mitigation for suppliers newly moving into High risk."
      : data.affectedSuppliers.length > 0
        ? "Review the most affected suppliers before the next sourcing decision."
        : "No supplier movement surfaced, but validate assumptions before closing the scenario.";

  return (
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      <SummaryMetric
        label="Top Impact"
        value={topSupplier ? topSupplier.supplierName : "No supplier movement"}
      />
      <SummaryMetric label="Moved To High" value={`${movedToHigh}`} />
      <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/80 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Recommended Next Step
        </p>
        <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text)]">{action}</p>
      </div>
    </div>
  );
}

function SimulatorInfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="metric-pill relative overflow-hidden pl-5"
      style={{
        borderLeft: "3px solid color-mix(in srgb, var(--primary) 35%, transparent)",
      }}
    >
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
    <div
      className="metric-pill relative overflow-hidden pl-5"
      style={{
        borderLeft: "3px solid color-mix(in srgb, var(--primary) 25%, transparent)",
      }}
    >
      <p className="metric-pill-label">{label}</p>
      <p className="metric-pill-detail">{detail}</p>
    </div>
  );
}

function CompareScenarioBuilder({
  title,
  config,
  suppliers,
  countries,
  commodities,
  onChange,
  loading,
}: {
  title: string;
  config: CompareScenarioConfig;
  suppliers: Array<{ supplier_id: number; supplier_name: string }>;
  countries: Array<{ label: string; value: string }>;
  commodities: Array<{ label: string; value: string }>;
  onChange: (value: CompareScenarioConfig) => void;
  loading: boolean;
}) {
  const options =
    config.scenarioType === "supplier_disruption"
      ? suppliers.map((supplier) => ({
          label: supplier.supplier_name,
          value: String(supplier.supplier_id),
        }))
      : config.scenarioType === "country_disruption"
        ? countries
        : config.scenarioType === "commodity_shock"
          ? commodities
          : config.targetType === "supplier"
            ? suppliers.map((supplier) => ({
                label: supplier.supplier_name,
                value: String(supplier.supplier_id),
              }))
            : config.targetType === "country"
              ? countries
              : commodities;

  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-5">
      <p className="eyebrow">{title}</p>
      <div className="mt-4 grid gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Scenario Type
          </span>
          <select
            className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
            style={{ borderColor: "var(--border)" }}
            value={config.scenarioType}
            onChange={(event) =>
              onChange({
                ...config,
                scenarioType: event.target.value as ScenarioType,
                supplierId: null,
                targetValue: "",
              })
            }
          >
            <option value="supplier_disruption">Supplier Disruption</option>
            <option value="country_disruption">Country Disruption</option>
            <option value="commodity_shock">Commodity Shock</option>
            <option value="operational_deterioration">Operational Deterioration</option>
          </select>
        </label>

        {config.scenarioType === "operational_deterioration" ? (
          <>
            <div className="grid gap-2 md:grid-cols-3">
              {targetTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="rounded-[1rem] border px-3 py-3 text-left text-sm transition"
                  style={{
                    borderColor:
                      config.targetType === option.value
                        ? "rgba(22, 101, 52, 0.35)"
                        : "var(--border)",
                    background:
                      config.targetType === option.value
                        ? "rgba(22, 101, 52, 0.08)"
                        : "rgba(255,255,255,0.8)",
                  }}
                  onClick={() =>
                    onChange({
                      ...config,
                      targetType: option.value,
                      targetValue: "",
                    })
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Target
              </span>
              <select
                className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                style={{ borderColor: "var(--border)" }}
                disabled={loading}
                value={config.targetValue}
                onChange={(event) => onChange({ ...config, targetValue: event.target.value })}
              >
                <option value="">Select target</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3">
              <MiniRange
                label="Delay"
                value={config.delayIncreasePct}
                onChange={(value) => onChange({ ...config, delayIncreasePct: value })}
              />
              <MiniRange
                label="Defect"
                value={config.defectIncreasePct}
                onChange={(value) => onChange({ ...config, defectIncreasePct: value })}
              />
              <MiniRange
                label="Cost Variance"
                value={config.costVarianceIncreasePct}
                onChange={(value) => onChange({ ...config, costVarianceIncreasePct: value })}
              />
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {config.scenarioType === "supplier_disruption"
                  ? "Supplier"
                  : config.scenarioType === "country_disruption"
                    ? "Country"
                    : "Commodity"}
              </span>
              <select
                className="rounded-2xl border bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                style={{ borderColor: "var(--border)" }}
                disabled={loading}
                value={
                  config.scenarioType === "supplier_disruption"
                    ? String(config.supplierId ?? "")
                    : config.targetValue
                }
                onChange={(event) =>
                  config.scenarioType === "supplier_disruption"
                    ? onChange({
                        ...config,
                        supplierId: event.target.value
                          ? Number.parseInt(event.target.value, 10)
                          : null,
                      })
                    : onChange({ ...config, targetValue: event.target.value })
                }
              >
                <option value="">Select</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 md:grid-cols-3">
              {disruptionSeverityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="rounded-[1rem] border px-3 py-3 text-left text-sm transition"
                  style={{
                    borderColor:
                      config.severity === option.value
                        ? "rgba(22, 101, 52, 0.35)"
                        : "var(--border)",
                    background:
                      config.severity === option.value
                        ? "rgba(22, 101, 52, 0.08)"
                        : "rgba(255,255,255,0.8)",
                  }}
                  onClick={() => onChange({ ...config, severity: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MiniRange({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="min-w-[5rem] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        className="w-full accent-[var(--primary)]"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="min-w-[2.5rem] text-right text-sm font-semibold text-[var(--text)]">
        {value}%
      </span>
    </label>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/80 px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[var(--text)]">{value}</p>
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
          x: chartItems.map((item) => `${item.fromBand} -> ${item.toBand}`),
          y: chartItems.map((item) => item.supplierCount),
          marker: {
            color: chartItems.map((item) => getRiskMovementColor(item.fromBand, item.toBand)),
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

function RiskCompositionChart({
  before,
  after,
}: {
  before: {
    highRiskSuppliers: number;
    mediumRiskSuppliers: number;
    lowRiskSuppliers: number;
  };
  after: {
    highRiskSuppliers: number;
    mediumRiskSuppliers: number;
    lowRiskSuppliers: number;
  };
}) {
  return (
    <PlotlyChart
      className="h-[300px]"
      data={[
        {
          type: "bar",
          orientation: "h",
          name: "Low",
          y: ["Before", "After"],
          x: [before.lowRiskSuppliers, after.lowRiskSuppliers],
          marker: { color: "#16a34a" },
          hovertemplate: "Risk Level: Low<br>Count of Suppliers: %{x}<extra></extra>",
        },
        {
          type: "bar",
          orientation: "h",
          name: "Medium",
          y: ["Before", "After"],
          x: [before.mediumRiskSuppliers, after.mediumRiskSuppliers],
          marker: { color: "#f59e0b" },
          hovertemplate: "Risk Level: Medium<br>Count of Suppliers: %{x}<extra></extra>",
        },
        {
          type: "bar",
          orientation: "h",
          name: "High",
          y: ["Before", "After"],
          x: [before.highRiskSuppliers, after.highRiskSuppliers],
          marker: { color: "#dc2626" },
          hovertemplate: "Risk Level: High<br>Count of Suppliers: %{x}<extra></extra>",
        },
      ]}
      layout={{
        margin: { l: 70, r: 20, t: 10, b: 30 },
        barmode: "stack",
        xaxis: {
          title: { text: "Suppliers", font: { size: 12, color: "#64748b" } },
          showgrid: true,
          gridcolor: "rgba(148, 163, 184, 0.2)",
          zeroline: false,
        },
        yaxis: { tickfont: { size: 12, color: "#64748b" } },
        legend: { orientation: "h", x: 0, y: 1.16 },
      }}
    />
  );
}

function ImpactDeltaChart({
  deltas,
}: {
  deltas: {
    highRiskSuppliers: number;
    avgOverallRisk: number;
    avgOperationalRisk: number;
    avgEsgRisk: number;
  };
}) {
  const labels = [
    "High Risk Suppliers",
    "Avg Overall Risk",
    "Avg Operational Risk",
    "Avg ESG Risk",
  ];
  const values = [
    deltas.highRiskSuppliers,
    deltas.avgOverallRisk,
    deltas.avgOperationalRisk,
    deltas.avgEsgRisk,
  ];
  return (
    <PlotlyChart
      className="h-[300px]"
      data={[
        {
          type: "bar",
          y: labels,
          x: values,
          orientation: "h",
          marker: {
            color: labels.map((label, index) => getImpactDeltaColor(label, values[index] ?? 0)),
          },
          text: values.map((value, index) =>
            index === 0 ? formatDelta(value, 0) : formatDelta(value, 2),
          ),
          textposition: "outside",
          cliponaxis: false,
          hovertemplate: "Metric: %{y}<br>Delta: %{x}<extra></extra>",
        },
      ]}
      layout={{
        margin: { l: 150, r: 28, t: 10, b: 30 },
        xaxis: {
          title: { text: "Delta", font: { size: 12, color: "#64748b" } },
          showgrid: true,
          gridcolor: "rgba(148, 163, 184, 0.2)",
          zerolinecolor: "rgba(22, 101, 52, 0.25)",
        },
        yaxis: { automargin: true, tickfont: { size: 11, color: "#64748b" } },
        showlegend: false,
      }}
    />
  );
}

function ImpactScopeSplitChart({
  items,
}: {
  items: Array<{ label: string; count: number; delta: number; color: string }>;
}) {
  return items.length ? (
    <PlotlyChart
      className="h-[320px]"
      data={[
        {
          type: "pie",
          labels: items.map((item) => item.label),
          values: items.map((item) => item.count),
          hole: 0.62,
          marker: { colors: items.map((item) => item.color) },
          textinfo: "label+percent",
          hovertemplate:
            "Impact Scope: %{label}<br>Count of Suppliers: %{value}<br>Delta Weight: %{customdata:.1f}<extra></extra>",
          customdata: items.map((item) => item.delta),
        },
      ]}
      layout={{
        margin: { l: 20, r: 20, t: 10, b: 10 },
        showlegend: false,
      }}
    />
  ) : (
    <div className="empty-state px-6 py-16 text-center text-sm">No impact scope data available.</div>
  );
}

function OperationalInputMeters({
  delay,
  defect,
  cost,
}: {
  delay: number;
  defect: number;
  cost: number;
}) {
  const items = [
    { label: "Delay Increase", value: delay, color: "#166534" },
    { label: "Defect Increase", value: defect, color: "#f59e0b" },
    { label: "Cost Variance Increase", value: cost, color: "#2563eb" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="visual-card-soft p-5">
          <p className="eyebrow">{item.label}</p>
          <div className="mt-5 flex items-center justify-center">
            <div
              className="relative flex h-28 w-28 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${item.color} ${item.value * 3.6}deg, rgba(226, 232, 240, 0.8) 0deg)`,
              }}
            >
              <div className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-white">
                <span className="text-lg font-semibold text-[var(--text)]">{item.value}%</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CountryImpactSummary({
  country,
  severity,
  items,
}: {
  country: string;
  severity: string;
  items: Array<{ label: string; count: number; delta: number; color: string }>;
}) {
  const direct = items.find((item) => item.label === "Direct Impact");
  const commodity = items.find((item) => item.label === "Commodity Spillover");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="visual-card-soft p-5">
        <p className="eyebrow">Selected Country</p>
        <p className="mt-4 text-xl font-semibold text-[var(--text)]">{country}</p>
      </div>
      <div className="visual-card-soft p-5">
        <p className="eyebrow">Severity</p>
        <p className="mt-4 text-xl font-semibold text-[var(--text)]">{capitalize(severity)}</p>
      </div>
      <div className="visual-card-soft p-5">
        <p className="eyebrow">Directly Affected Suppliers</p>
        <p className="mt-4 text-xl font-semibold text-[var(--text)]">
          {direct?.count ?? 0}
        </p>
      </div>
      <div className="visual-card-soft p-5 md:col-span-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="eyebrow">Direct Country Impact</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Suppliers inside the selected country receive the main disruption pressure.
            </p>
            <p className="mt-4 text-2xl font-semibold text-[var(--text)]">
              {direct?.count ?? 0}
            </p>
            <p className="text-sm text-[var(--muted)]">
              suppliers with direct country-level impact
            </p>
          </div>
          <div>
            <p className="eyebrow">Commodity Spillover</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Related suppliers outside the country can still be affected when they share commodity exposure.
            </p>
            <p className="mt-4 text-2xl font-semibold text-[var(--text)]">
              {commodity?.count ?? 0}
            </p>
            <p className="text-sm text-[var(--muted)]">
              suppliers with commodity-linked spillover
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommodityImpactSummary({
  commodity,
  severity,
  items,
}: {
  commodity: string;
  severity: string;
  items: Array<{ label: string; count: number; delta: number; color: string }>;
}) {
  const direct = items.find((item) => item.label === "Direct Impact");
  const country = items.find((item) => item.label === "Country Spillover");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="visual-card-soft p-5">
        <p className="eyebrow">Selected Commodity</p>
        <p className="mt-4 text-xl font-semibold text-[var(--text)]">{commodity}</p>
      </div>
      <div className="visual-card-soft p-5">
        <p className="eyebrow">Severity</p>
        <p className="mt-4 text-xl font-semibold text-[var(--text)]">{capitalize(severity)}</p>
      </div>
      <div className="visual-card-soft p-5">
        <p className="eyebrow">Directly Affected Suppliers</p>
        <p className="mt-4 text-xl font-semibold text-[var(--text)]">
          {direct?.count ?? 0}
        </p>
      </div>
      <div className="visual-card-soft p-5 md:col-span-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="eyebrow">Direct Commodity Impact</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Suppliers mapped to the selected commodity receive the main shock.
            </p>
            <p className="mt-4 text-2xl font-semibold text-[var(--text)]">
              {direct?.count ?? 0}
            </p>
            <p className="text-sm text-[var(--muted)]">
              suppliers with direct commodity impact
            </p>
          </div>
          <div>
            <p className="eyebrow">Country Spillover</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Countries hosting the affected commodity network can see secondary supplier pressure.
            </p>
            <p className="mt-4 text-2xl font-semibold text-[var(--text)]">
              {country?.count ?? 0}
            </p>
            <p className="text-sm text-[var(--muted)]">
              suppliers with country-linked spillover
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonWinnerPanel({
  left,
  right,
}: {
  left: SimulatorScenarioResponse;
  right: SimulatorScenarioResponse;
}) {
  const leftScore = scoreScenarioImpact(left);
  const rightScore = scoreScenarioImpact(right);
  const winner = leftScore >= rightScore ? "Scenario A" : "Scenario B";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SummaryMetric label="Scenario A Score" value={leftScore.toFixed(2)} />
      <SummaryMetric label="Scenario B Score" value={rightScore.toFixed(2)} />
      <SummaryMetric label="Higher Impact" value={winner} />
    </div>
  );
}

function ComparisonScenarioCard({
  title,
  data,
}: {
  title: string;
  data: SimulatorScenarioResponse;
}) {
  return (
    <section className="visual-card p-6">
      <div className="visual-header">
        <h2 className="visual-title">{title}</h2>
        <p className="visual-description">{data.scenario.title}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryMetric
          label="High Risk Delta"
          value={formatDelta(data.deltas.highRiskSuppliers, 0)}
        />
        <SummaryMetric
          label="Overall Risk Delta"
          value={formatDelta(data.deltas.avgOverallRisk, 2)}
        />
        <SummaryMetric
          label="Operational Delta"
          value={formatDelta(data.deltas.avgOperationalRisk, 2)}
        />
        <SummaryMetric
          label="Affected Suppliers"
          value={`${data.affectedSuppliers.length}`}
        />
      </div>
    </section>
  );
}

function ComparisonCompositionChart({
  left,
  right,
}: {
  left: SimulatorScenarioResponse;
  right: SimulatorScenarioResponse;
}) {
  return (
    <PlotlyChart
      className="h-[320px]"
      data={[
        {
          type: "bar",
          orientation: "h",
          name: "Low",
          y: ["A Before", "A After", "B Before", "B After"],
          x: [
            left.before.lowRiskSuppliers,
            left.after.lowRiskSuppliers,
            right.before.lowRiskSuppliers,
            right.after.lowRiskSuppliers,
          ],
          marker: { color: "#16a34a" },
        },
        {
          type: "bar",
          orientation: "h",
          name: "Medium",
          y: ["A Before", "A After", "B Before", "B After"],
          x: [
            left.before.mediumRiskSuppliers,
            left.after.mediumRiskSuppliers,
            right.before.mediumRiskSuppliers,
            right.after.mediumRiskSuppliers,
          ],
          marker: { color: "#f59e0b" },
        },
        {
          type: "bar",
          orientation: "h",
          name: "High",
          y: ["A Before", "A After", "B Before", "B After"],
          x: [
            left.before.highRiskSuppliers,
            left.after.highRiskSuppliers,
            right.before.highRiskSuppliers,
            right.after.highRiskSuppliers,
          ],
          marker: { color: "#dc2626" },
        },
      ]}
      layout={{
        margin: { l: 80, r: 20, t: 10, b: 30 },
        barmode: "stack",
        legend: { orientation: "h", x: 0, y: 1.16 },
        xaxis: { title: { text: "Suppliers", font: { size: 12, color: "#64748b" } } },
      }}
    />
  );
}

function ComparisonDeltaChart({
  left,
  right,
}: {
  left: SimulatorScenarioResponse;
  right: SimulatorScenarioResponse;
}) {
  const labels = [
    "High Risk Suppliers",
    "Avg Overall Risk",
    "Avg Operational Risk",
    "Avg ESG Risk",
  ];
  const leftValues = [
    left.deltas.highRiskSuppliers,
    left.deltas.avgOverallRisk,
    left.deltas.avgOperationalRisk,
    left.deltas.avgEsgRisk,
  ];
  const rightValues = [
    right.deltas.highRiskSuppliers,
    right.deltas.avgOverallRisk,
    right.deltas.avgOperationalRisk,
    right.deltas.avgEsgRisk,
  ];

  return (
    <PlotlyChart
      className="h-[320px]"
      data={[
        {
          type: "bar",
          orientation: "h",
          name: "Scenario A",
          y: labels,
          x: leftValues,
          marker: { color: "#166534" },
        },
        {
          type: "bar",
          orientation: "h",
          name: "Scenario B",
          y: labels,
          x: rightValues,
          marker: { color: "#2563eb" },
        },
      ]}
      layout={{
        margin: { l: 150, r: 20, t: 10, b: 30 },
        barmode: "group",
        legend: { orientation: "h", x: 0, y: 1.16 },
        xaxis: { title: { text: "Delta", font: { size: 12, color: "#64748b" } } },
      }}
    />
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
          text: chartItems.map((item) => `+${item.deltaOverallRisk.toFixed(2)}`),
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
  const [query, setQuery] = useState("");
  const [riskBand, setRiskBand] = useState("all");
  const filteredItems = [...items]
    .sort((a, b) => b.deltaOverallRisk - a.deltaOverallRisk)
    .filter((item) => {
      const matchesQuery = `${item.supplierName} ${item.country ?? ""} ${item.impactReason}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesBand = riskBand === "all" || item.afterRiskLevel === riskBand;
      return matchesQuery && matchesBand;
    });

  return items.length ? (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          className="input-field md:max-w-sm"
          value={query}
          placeholder="Search supplier, country, or reason"
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="select-field md:max-w-[220px]"
          value={riskBand}
          onChange={(event) => setRiskBand(event.target.value)}
        >
          <option value="all">All after-risk bands</option>
          <option value="High">High after risk</option>
          <option value="Medium">Medium after risk</option>
          <option value="Low">Low after risk</option>
        </select>
      </div>
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
            {filteredItems.map((item) => (
              <tr key={item.supplierId}>
                <td className="font-semibold text-[var(--text)]">{item.supplierName}</td>
                <td>{item.country ?? "-"}</td>
                <td>{item.beforeOverallRisk.toFixed(2)}</td>
                <td>{item.afterOverallRisk.toFixed(2)}</td>
                <td className="font-semibold text-[var(--primary)]">
                  +{item.deltaOverallRisk.toFixed(2)}
                </td>
                <td>
                  <span className={item.afterRiskLevel === "High" ? "tag tag-neutral border-rose-200 bg-rose-50 text-rose-700" : "tag tag-neutral"}>
                    {item.beforeRiskLevel}
                    {" -> "}
                    {item.afterRiskLevel}
                  </span>
                </td>
                <td>{item.impactReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredItems.length ? (
          <div className="empty-state mt-4 px-6 py-10 text-center text-sm">
            No affected suppliers match the current filters.
          </div>
        ) : null}
      </div>
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

function buildScenarioPayload(config: CompareScenarioConfig): SimulatorScenarioRequest {
  if (config.scenarioType === "supplier_disruption") {
    return {
      scenarioType: "supplier_disruption",
      supplierId: config.supplierId ?? 0,
      severity: config.severity,
    };
  }
  if (config.scenarioType === "country_disruption") {
    return {
      scenarioType: "country_disruption",
      targetValue: config.targetValue,
      severity: config.severity,
    };
  }
  if (config.scenarioType === "commodity_shock") {
    return {
      scenarioType: "commodity_shock",
      targetValue: config.targetValue,
      severity: config.severity,
    };
  }
  return {
    scenarioType: "operational_deterioration",
    targetType: config.targetType,
    targetValue: config.targetValue,
    delayIncreasePct: config.delayIncreasePct,
    defectIncreasePct: config.defectIncreasePct,
    costVarianceIncreasePct: config.costVarianceIncreasePct,
  };
}

function isScenarioConfigRunnable(config: CompareScenarioConfig): boolean {
  if (config.scenarioType === "supplier_disruption") {
    return !!config.supplierId;
  }
  if (config.scenarioType === "country_disruption" || config.scenarioType === "commodity_shock") {
    return !!config.targetValue;
  }
  return (
    !!config.targetValue &&
    (config.delayIncreasePct > 0 || config.defectIncreasePct > 0 || config.costVarianceIncreasePct > 0)
  );
}

function scoreScenarioImpact(data: SimulatorScenarioResponse): number {
  return (
    data.deltas.highRiskSuppliers * 1.5 +
    data.deltas.avgOverallRisk * 4 +
    data.deltas.avgOperationalRisk * 3 +
    data.affectedSuppliers.length * 0.35
  );
}

function buildComparisonHeadline(
  left: SimulatorScenarioResponse,
  right: SimulatorScenarioResponse,
): string {
  const leftScore = scoreScenarioImpact(left);
  const rightScore = scoreScenarioImpact(right);
  const winner = leftScore >= rightScore ? "Scenario A" : "Scenario B";
  return `${winner} produces the larger overall impact across high-risk supplier growth, average risk uplift, and affected suppliers.`;
}

function buildAdvisorSimulatorContext(
  data: SimulatorScenarioResponse,
): AdvisorSimulatorContext {
  return {
    scenarioTitle: data.scenario.title,
    scenarioSummary: data.scenario.summary,
    highRiskDelta: data.deltas.highRiskSuppliers,
    overallRiskDelta: data.deltas.avgOverallRisk,
    operationalRiskDelta: data.deltas.avgOperationalRisk,
    esgRiskDelta: data.deltas.avgEsgRisk,
    affectedSupplierCount: data.affectedSuppliers.length,
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

function getRiskMovementColor(fromBand: string, toBand: string): string {
  const bandOrder: Record<string, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
  };

  const fromValue = bandOrder[fromBand] ?? 0;
  const toValue = bandOrder[toBand] ?? 0;

  if (toValue > fromValue) {
    return "#dc2626";
  }
  if (toValue < fromValue) {
    return "#16a34a";
  }
  return "#cbd5e1";
}

function getImpactDeltaColor(label: string, value: number): string {
  const higherIsWorse = new Set([
    "High Risk Suppliers",
    "Avg Overall Risk",
    "Avg Operational Risk",
    "Avg ESG Risk",
  ]);

  if (higherIsWorse.has(label)) {
    if (value > 0) return "#dc2626";
    if (value < 0) return "#16a34a";
    return "#cbd5e1";
  }

  if (value > 0) return "#16a34a";
  if (value < 0) return "#dc2626";
  return "#cbd5e1";
}

function formatDelta(value: number, precision: number): string {
  return value > 0 ? `+${value.toFixed(precision)}` : value.toFixed(precision);
}

function getMissingInputMessage({
  scenarioType,
  supplierId,
  targetValue,
  compareA,
  compareB,
  delayIncreasePct,
  defectIncreasePct,
  costVarianceIncreasePct,
}: {
  scenarioType: SimulatorMode;
  supplierId: number | null;
  targetValue: string;
  compareA: CompareScenarioConfig;
  compareB: CompareScenarioConfig;
  delayIncreasePct: number;
  defectIncreasePct: number;
  costVarianceIncreasePct: number;
}): string {
  if (scenarioType === "scenario_compare") {
    if (!isScenarioConfigRunnable(compareA)) return "Complete Scenario A to run the comparison.";
    if (!isScenarioConfigRunnable(compareB)) return "Complete Scenario B to run the comparison.";
    return "Ready to compare both scenarios.";
  }
  if (scenarioType === "supplier_disruption" && !supplierId) {
    return "Select a supplier to run this disruption scenario.";
  }
  if (scenarioType === "country_disruption" && !targetValue) {
    return "Select a country to run this disruption scenario.";
  }
  if (scenarioType === "commodity_shock" && !targetValue) {
    return "Select a commodity to run this shock scenario.";
  }
  if (scenarioType === "operational_deterioration") {
    if (!targetValue) return "Select a target scope to run operational deterioration.";
    if (delayIncreasePct <= 0 && defectIncreasePct <= 0 && costVarianceIncreasePct <= 0) {
      return "Increase at least one operational input above 0%.";
    }
  }
  return "Ready to run.";
}

function buildScenarioPreview({
  scenarioType,
  selectedScenarioLabel,
  selectedSupplierName,
  selectedTargetLabel,
  severity,
  targetType,
  delayIncreasePct,
  defectIncreasePct,
  costVarianceIncreasePct,
}: {
  scenarioType: SimulatorMode;
  selectedScenarioLabel: string;
  selectedSupplierName: string | null;
  selectedTargetLabel: string | null;
  severity: SupplierDisruptionSeverity;
  targetType: OperationalTargetType;
  delayIncreasePct: number;
  defectIncreasePct: number;
  costVarianceIncreasePct: number;
}): string {
  if (scenarioType === "scenario_compare") {
    return "Ready to run both scenarios and compare which one creates the larger risk movement.";
  }
  if (scenarioType === "supplier_disruption") {
    return `Ready to simulate ${severity} disruption for ${selectedSupplierName ?? "the selected supplier"}.`;
  }
  if (scenarioType === "country_disruption" || scenarioType === "commodity_shock") {
    return `Ready to simulate ${severity} ${selectedScenarioLabel.toLowerCase()} for ${selectedTargetLabel ?? "the selected target"}.`;
  }
  return `Ready to stress ${targetType} ${selectedTargetLabel ?? "target"} with ${delayIncreasePct}% delay, ${defectIncreasePct}% defect, and ${costVarianceIncreasePct}% cost variance pressure.`;
}

function buildScenarioHeadline(data: {
  scenario: {
    scenarioType: string;
    supplierName?: string | null;
    country?: string | null;
    severity?: string | null;
    targetType?: string | null;
    targetValue?: string | null;
  };
  deltas: { highRiskSuppliers: number; avgOverallRisk: number };
}): string {
  if (data.scenario.scenarioType === "supplier_disruption") {
    const supplier = data.scenario.supplierName ?? "selected supplier";
    const severity = data.scenario.severity ?? "scenario";
    return `${severity[0].toUpperCase()}${severity.slice(1)} disruption on ${supplier} changes high-risk suppliers by ${formatDelta(
      data.deltas.highRiskSuppliers,
      0,
    )} and overall risk by ${formatDelta(data.deltas.avgOverallRisk, 2)}.`;
  }

  if (data.scenario.scenarioType === "country_disruption") {
    return `${capitalize(data.scenario.severity ?? "Scenario")} country disruption in ${data.scenario.country ?? data.scenario.targetValue ?? "the selected country"} changes high-risk suppliers by ${formatDelta(
      data.deltas.highRiskSuppliers,
      0,
    )} and overall risk by ${formatDelta(data.deltas.avgOverallRisk, 2)}.`;
  }

  if (data.scenario.scenarioType === "commodity_shock") {
    return `${capitalize(data.scenario.severity ?? "Scenario")} commodity shock for ${data.scenario.targetValue ?? "the selected commodity"} changes high-risk suppliers by ${formatDelta(
      data.deltas.highRiskSuppliers,
      0,
    )} and overall risk by ${formatDelta(data.deltas.avgOverallRisk, 2)}.`;
  }

  return `${capitalize(data.scenario.targetType ?? "target")} operational deterioration on ${data.scenario.targetValue ?? "selected target"} changes high-risk suppliers by ${formatDelta(
    data.deltas.highRiskSuppliers,
    0,
  )} and overall risk by ${formatDelta(data.deltas.avgOverallRisk, 2)}.`;
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
