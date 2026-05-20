import { useState } from "react";

import type { DueDiligenceResponse, RiskSupplierItem } from "../../../api/risk";
import { AiProvenanceBadge } from "../../../components/common/AiProvenanceBadge";
import { StructuredContent } from "../../../components/common/StructuredContent";

interface DueDiligencePanelProps {
  suppliers: RiskSupplierItem[];
  suppliersLoading: boolean;
  result: DueDiligenceResponse | undefined;
  isLoading: boolean;
  onRun: (supplierId: number) => void;
}

export function DueDiligencePanel({
  suppliers,
  suppliersLoading,
  result,
  isLoading,
  onRun,
}: DueDiligencePanelProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const selectedSupplier = suppliers.find((supplier) => supplier.supplierId === selectedSupplierId);

  return (
    <section className="surface-card p-6">
      <WorkflowStrip activeStep={result ? 3 : selectedSupplier ? 2 : 1} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="visual-card-soft p-5">
          <div className="visual-header">
            <h2 className="visual-title">Supplier Selection</h2>
            <p className="visual-description">
              Choose one of the current high-risk suppliers and run the due diligence agent against the latest signals.
            </p>
          </div>

          {suppliersLoading ? (
            <div className="h-[170px] animate-pulse rounded-3xl bg-slate-100" />
          ) : suppliers.length === 0 ? (
            <div className="empty-state px-6 py-12 text-center text-sm">
              No high-risk suppliers are available for due diligence.
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Supplier
                </span>
                <select
                  value={selectedSupplierId}
                  onChange={(event) =>
                    setSelectedSupplierId(event.target.value ? Number(event.target.value) : "")
                  }
                  className="select-field min-h-12 rounded-2xl bg-white px-4 text-sm text-[var(--text-secondary)]"
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.supplierId} value={supplier.supplierId}>
                      {supplier.supplierName} | {supplier.country ?? "Unknown country"} | {supplier.overallRiskScore.toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-primary">{suppliers.length} suppliers available</span>
                <span className="text-xs text-[var(--muted)]">
                  Suppliers are sourced from the current top-risk list.
                </span>
              </div>
              {selectedSupplier ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <MiniMetric label="Overall" value={selectedSupplier.overallRiskScore.toFixed(2)} />
                  <MiniMetric label="Operational" value={selectedSupplier.operationalRiskScore.toFixed(2)} />
                  <MiniMetric label="ESG" value={selectedSupplier.esgRiskScore.toFixed(2)} />
                </div>
              ) : null}
              <button
                type="button"
                className="btn-primary w-full"
                disabled={!selectedSupplier || isLoading}
                onClick={() => selectedSupplier && onRun(selectedSupplier.supplierId)}
              >
                {isLoading ? "Running..." : result ? "Run Again" : "Run Analysis"}
              </button>
              {result ? (
                <p className="text-xs text-[var(--muted)]">
                  Analysis completed for {result.supplier}. You can run again for the selected supplier.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <SelectedSupplierPreview
            supplier={selectedSupplier}
          />
          {!result ? <AgentOutputPreview /> : <ResultNavigation />}
        </div>
      </div>

      {result ? <DueDiligenceResult result={result} /> : null}
    </section>
  );
}

function WorkflowStrip({ activeStep }: { activeStep: number }) {
  const steps = ["Select supplier", "Run investigation", "Review decision"];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === activeStep;
        const complete = stepNumber < activeStep;
        return (
          <div
            key={step}
            className="flex items-center gap-3 rounded-[1rem] border px-4 py-3"
            style={{
              borderColor: active || complete ? "rgba(22, 101, 52, 0.28)" : "var(--border)",
              background: active || complete ? "rgba(240,253,244,0.82)" : "rgba(255,255,255,0.68)",
            }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold"
              style={{
                background: active || complete ? "var(--primary)" : "var(--surface-2)",
                color: active || complete ? "#fff" : "var(--muted)",
              }}
            >
              {stepNumber}
            </span>
            <span className="text-sm font-semibold text-[var(--text)]">{step}</span>
          </div>
        );
      })}
    </div>
  );
}

function SelectedSupplierPreview({
  supplier,
}: {
  supplier: RiskSupplierItem | undefined;
}) {
  return (
    <div className="visual-card-soft p-5">
      <div className="visual-header">
        <h2 className="visual-title">Selected Supplier Context</h2>
        <p className="visual-description">
          Review the current risk signal before launching the agent.
        </p>
      </div>
      {!supplier ? (
        <div className="empty-state px-6 py-12 text-center text-sm">
          Select a supplier from the investigation queue to preview risk signals.
        </div>
      ) : (
        <>
          <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-lg font-semibold text-[var(--text)]">{supplier.supplierName}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {supplier.country ?? "Unknown country"} | {supplier.tier ?? "No tier"} | {supplier.category ?? "No category"}
                </p>
              </div>
              <RiskLevelBadge level={supplier.riskLevel} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Avg Delay" value={supplier.avgDelay.toFixed(2)} />
              <MiniMetric label="Defect Rate" value={`${supplier.avgDefect.toFixed(2)}%`} />
              <MiniMetric label="Cost Variance" value={`${supplier.avgCostVariance.toFixed(2)}%`} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              The agent will generate a decision, rationale, checklist, evidence gaps, and recommended actions.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function AgentOutputPreview() {
  return (
    <div className="visual-card-soft p-5">
      <p className="eyebrow">Agent Output</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {["Decision", "Rationale", "Checklist", "Evidence Gaps", "Recommended Actions", "AI Summary"].map((item) => (
          <div key={item} className="rounded-xl border border-[var(--border)] bg-white/75 px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultNavigation() {
  const links = [
    ["Decision", "#dd-decision"],
    ["Actions", "#dd-actions"],
    ["Checklist", "#dd-checklist"],
    ["Evidence", "#dd-evidence"],
    ["AI Summary", "#dd-summary"],
  ];

  return (
    <div className="visual-card-soft p-5">
      <p className="eyebrow">Result Navigation</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)]"
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

function DueDiligenceResult({ result }: { result: DueDiligenceResponse }) {
  const evidenceItems = result.evidenceGaps?.length ? result.evidenceGaps : result.issues;
  return (
    <div className="mt-8 grid gap-6">
      <section
        id="dd-decision"
        className="scroll-mt-28 rounded-[2rem] border p-6 text-white"
        style={{
          borderColor: "var(--primary-muted)",
          background: "linear-gradient(135deg, #166534 0%, #14532d 100%)",
        }}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr] xl:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-100">
              Due Diligence Case {result.caseId ? `| ${result.caseId}` : ""}
            </p>
            <h4 className="mt-2 text-2xl font-semibold">{result.supplier}</h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-green-100">
              {result.country || "Unknown country"} | {result.tier || "No tier"} | {result.status || "No status"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm text-white ring-1 ring-white/15">
            Decision: <span className="font-semibold">{result.decision || result.overall}</span>{" "}
            <span className="text-green-100">({result.overallRiskScore.toFixed(2)})</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Metric label="Operational Risk" value={`${result.opRisk} (${result.opRiskScore.toFixed(2)})`} />
          <Metric label="ESG Risk" value={`${result.esgRisk} (${result.esgRiskScore.toFixed(2)})`} />
          <Metric label="Overall Risk" value={`${result.overall} (${result.overallRiskScore.toFixed(2)})`} />
        </div>
      </section>

      <section className="visual-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Decision Rationale</p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">
              {result.decision || "Review Required"}
            </h3>
          </div>
          <AiProvenanceBadge
            provenance={{
              source: result.ai_source,
              provider: result.ai_provider,
              model: result.ai_model,
              traceId: result.ai_trace_id,
            }}
          />
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {(result.decisionRationale || []).map((item) => (
            <li key={item} className="surface-subtle px-4 py-4 text-sm leading-6 text-[var(--text-secondary)]">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="dd-actions" className="visual-card scroll-mt-28 p-6">
        <div className="visual-header">
          <h3 className="visual-title">Recommended Actions</h3>
          <p className="visual-description">Task-style actions to move the supplier case forward.</p>
        </div>
        <div className="grid gap-3">
          {(result.recommendedActions || []).map((action, index) => (
            <div key={action} className="surface-subtle px-4 py-4 text-sm leading-6 text-[var(--text-secondary)] shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="tag tag-neutral">To Do</span>
                <span className="text-xs font-semibold text-[var(--muted)]">Action {index + 1}</span>
              </div>
              {action}
            </div>
          ))}
        </div>
      </section>

      <section className="visual-card p-6">
        <div className="visual-header">
          <h3 className="visual-title">Risk Drivers</h3>
          <p className="visual-description">Signals most responsible for the current decision.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(result.riskDrivers || []).map((driver) => (
            <div key={driver.label} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--text)]">{driver.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{driver.status}</p>
                </div>
                <span className="shrink-0 text-lg font-semibold text-[var(--primary)]">
                  {driver.value.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="dd-checklist" className="visual-card scroll-mt-28 p-6">
          <div className="visual-header">
            <h3 className="visual-title">Investigation Checklist</h3>
            <p className="visual-description">Evidence and review checks required for the case.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {(result.investigationChecklist || []).map((item) => {
              const context = buildChecklistContext(item, evidenceItems);
              return (
              <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[var(--text)]">{item.label}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
                {context.gaps.length ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                      Gap
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-5 text-amber-900">
                      {context.gaps.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {context.meaning ? (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      What This Means
                    </p>
                    <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
                      {context.meaning}
                    </p>
                  </div>
                ) : null}
              </div>
              );
            })}
          </div>
      </section>

      <section id="dd-evidence" className="visual-card scroll-mt-28 p-6">
        <div className="visual-header">
          <h3 className="visual-title">Evidence Gaps</h3>
          <p className="visual-description">
            Missing or unresolved evidence that can block a confident supplier decision.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {evidenceItems.map((issue) => (
            <div key={issue} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              {issue}
            </div>
          ))}
        </div>
      </section>

      <section id="dd-summary" className="visual-card scroll-mt-28 p-6">
        <div className="visual-header">
          <h3 className="visual-title">AI Recommendation</h3>
          <p className="visual-description">Narrative summary generated from connected supplier signals.</p>
        </div>
        <div className="surface-soft px-4 py-4">
          <StructuredContent content={result.aiSummary} />
        </div>
      </section>
    </div>
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

function StatusBadge({ status }: { status: string }) {
  return <span className={status === "Complete" ? "tag tag-primary" : "tag tag-neutral"}>{status}</span>;
}

function buildChecklistContext(
  item: { label: string; status: string; detail: string },
  evidenceItems: string[],
): { gaps: string[]; meaning: string | null } {
  const label = item.label.toLowerCase();
  const detail = item.detail.toLowerCase();
  const isEvidenceCheck = label.includes("evidence") || detail.includes("evidence");
  const gaps = isEvidenceCheck ? evidenceItems.slice(0, 3) : [];

  if (detail.includes("baseline only") || evidenceItems.some((gap) => gap.toLowerCase().includes("baseline only"))) {
    return {
      gaps,
      meaning:
        "Supplier evidence is baseline only means the supplier has enough basic information to create a record, but not enough supporting proof for a confident due diligence decision. Additional documents, certifications, traceability evidence, or validation notes may still be required.",
    };
  }

  if (isEvidenceCheck && gaps.length) {
    return {
      gaps,
      meaning:
        "This check is marked for review because the agent found evidence gaps that should be resolved before relying on the supplier decision.",
    };
  }

  if (item.status !== "Complete") {
    return {
      gaps: [],
      meaning:
        "This checklist item still needs reviewer attention before the due diligence case can be treated as complete.",
    };
  }

  return { gaps: [], meaning: null };
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/15 px-4 py-4 ring-1 ring-white/15 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-100">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
