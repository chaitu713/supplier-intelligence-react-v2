import { ApiError } from "../../../api/client";
import { DueDiligencePanel } from "../components/DueDiligencePanel";
import { useDueDiligence, useTopRiskSuppliers } from "../hooks/useRiskMonitoring";

export function DueDiligencePage() {
  const topSuppliersQuery = useTopRiskSuppliers();
  const dueDiligenceMutation = useDueDiligence();

  const errorMessage = getErrorMessage(
    topSuppliersQuery.error ?? dueDiligenceMutation.error,
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
            <p className="eyebrow text-sm">Due Diligence Agent</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              Structured supplier investigation
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
              Run AI-assisted evaluation for one of the current high-risk suppliers and
              review the output in an executive summary layout.
            </p>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <DueDiligencePanel
          suppliers={topSuppliersQuery.data ?? []}
          suppliersLoading={topSuppliersQuery.isLoading}
          result={dueDiligenceMutation.data}
          isLoading={dueDiligenceMutation.isPending}
          onRun={(supplierId) => dueDiligenceMutation.mutate(supplierId)}
        />
      </div>
    </div>
  );
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

  return "Something went wrong while running due diligence.";
}
