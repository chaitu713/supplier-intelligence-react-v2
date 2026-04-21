import type { IngestionJob, IngestionStep } from "../../../api/documents";

const stepStyles: Record<IngestionStep["status"], string> = {
  pending: "border-[color:var(--border)] bg-[color:var(--surface-2)] text-[var(--muted)]",
  processing:
    "border-[color:var(--primary-muted)] bg-[color:var(--primary-soft)] text-[var(--primary)]",
  completed:
    "border-[color:var(--primary-muted)] bg-[color:var(--primary-soft)] text-[var(--primary)]",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

interface ProcessingTimelineProps {
  job: IngestionJob | undefined;
  isLoading: boolean;
}

export function ProcessingTimeline({
  job,
  isLoading,
}: ProcessingTimelineProps) {
  if (isLoading) {
    return (
      <div className="surface-card p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">Processing Timeline</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Live ingestion status across upload, extraction, parsing, and persistence.
          </p>
        </div>
        <span className="tag tag-primary px-3 py-1 text-xs font-medium uppercase tracking-wide">
          {job?.status ?? "idle"}
        </span>
      </div>

      {job ? (
        <ol className="mt-6 space-y-3">
          {job.steps.map((step) => (
            <li
              key={step.name}
              className={`rounded-2xl border px-4 py-4 ${stepStyles[step.status]}`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold capitalize">{step.name}</span>
                <span className="text-xs font-medium uppercase tracking-wide">
                  {step.status}
                </span>
              </div>
              {step.message ? (
                <p className="mt-2 text-sm opacity-90">{step.message}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-state mt-6 p-6 text-sm">
          Start an ingestion job to see the live pipeline timeline here.
        </div>
      )}
    </section>
  );
}
