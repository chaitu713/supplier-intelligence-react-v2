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
        <header className="page-header px-8 py-8">
          <p className="eyebrow text-sm">Due Diligence Agent</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Structured supplier investigation
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            Run AI-assisted evaluation for one of the current high-risk suppliers and
            review the output in an executive summary layout.
          </p>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <DueDiligencePanel
          suppliers={topSuppliersQuery.data ?? []}
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

