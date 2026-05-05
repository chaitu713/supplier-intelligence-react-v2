import { useState } from "react";

import type { DueDiligenceResponse, RiskSupplierItem } from "../../../api/risk";
import { StructuredContent } from "../../../components/common/StructuredContent";

interface DueDiligencePanelProps {
  suppliers: RiskSupplierItem[];
  result: DueDiligenceResponse | undefined;
  isLoading: boolean;
  onRun: (supplierId: number) => void;
}

export function DueDiligencePanel({
  suppliers,
  result,
  isLoading,
  onRun,
}: DueDiligencePanelProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");

  return (
    <section className="surface-card p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">
            Due Diligence Agent
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--text)]">
            Structured supplier investigation
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Run AI-assisted evaluation for one of the current high-risk suppliers and review the output in an executive summary layout.
          </p>
        </div>

        <div className="surface-soft flex w-full flex-col gap-3 p-4 xl:max-w-xl">
          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={selectedSupplierId}
              onChange={(event) =>
                setSelectedSupplierId(event.target.value ? Number(event.target.value) : "")
              }
              className="select-field min-h-12 flex-1 rounded-2xl bg-white px-4 text-sm text-[var(--text-secondary)]"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplierId} value={supplier.supplierId}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={selectedSupplierId === "" || isLoading}
              onClick={() => selectedSupplierId !== "" && onRun(selectedSupplierId)}
              className="btn-primary px-5 text-sm"
            >
              {isLoading ? "Running..." : "Run Analysis"}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Best for reviewing suppliers already flagged by the risk dashboard.
          </p>
        </div>
      </div>

      {result ? (
        <div className="mt-8 space-y-6">
          <div className="rounded-[2rem] border p-6 text-white" style={{ borderColor: "var(--primary-muted)", background: "linear-gradient(135deg, #166534 0%, #14532d 100%)" }}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
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
                <span className="text-green-100">({result.overallRiskScore.toFixed(1)})</span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Metric label="Operational Risk" value={`${result.opRisk} (${result.opRiskScore.toFixed(1)})`} />
              <Metric label="ESG Risk" value={`${result.esgRisk} (${result.esgRiskScore.toFixed(1)})`} />
              <Metric label="Overall Risk" value={`${result.overall} (${result.overallRiskScore.toFixed(1)})`} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="surface-card p-5 shadow-sm">
              <h5 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Due Diligence Decision
              </h5>
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                <p className="text-xl font-semibold text-emerald-950">{result.decision || "Review Required"}</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-900">
                  {(result.decisionRationale || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div className="surface-soft p-5">
              <h5 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Recommended Actions
              </h5>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(result.recommendedActions || []).map((action) => (
                  <div key={action} className="surface-subtle px-4 py-4 text-sm leading-6 text-[var(--text-secondary)] shadow-sm">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="surface-card p-5 shadow-sm">
              <h5 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Investigation Checklist
              </h5>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(result.investigationChecklist || []).map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-[var(--text)]">{item.label}</p>
                      <span className={item.status === "Complete" ? "tag tag-success" : "tag tag-warning"}>{item.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-5 shadow-sm">
              <h5 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Risk Drivers
              </h5>
              <div className="mt-4 space-y-3">
                {(result.riskDrivers || []).map((driver) => (
                  <div key={driver.label} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                    <div>
                      <p className="font-semibold text-[var(--text)]">{driver.label}</p>
                      <p className="text-xs text-[var(--muted)]">{driver.status}</p>
                    </div>
                    <span className="text-lg font-semibold text-[var(--primary)]">{driver.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="surface-soft p-5">
              <h5 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Evidence Gaps
              </h5>
              <ul className="mt-4 space-y-3">
                {(result.evidenceGaps?.length ? result.evidenceGaps : result.issues).map((issue) => (
                  <li
                    key={issue}
                  className="surface-subtle px-4 py-4 text-sm leading-6 text-[var(--text-secondary)] shadow-sm"
                  >
                    <div className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--primary)]" />
                      <span>{issue}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card p-5 shadow-sm">
              <h5 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Recommendation
              </h5>
              <div className="surface-soft mt-4 px-4 py-4">
                <StructuredContent content={result.aiSummary} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
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
