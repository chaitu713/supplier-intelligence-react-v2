import type { IngestionJob } from "../../../api/documents";

interface ProcessingSummaryCardProps {
  job: IngestionJob | undefined;
}

export function ProcessingSummaryCardRef({ job }: ProcessingSummaryCardProps) {
  const summary = job?.summary;

  return (
    <section
      className="surface-card p-6"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, white), var(--surface))",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm"
          style={{ color: "var(--primary)" }}
        >
          ✓
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">Processing Summary</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Final record counts from the ingestion pipeline.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryMetric
          label="Supplier records"
          value={summary?.supplierRecordsAdded ?? 0}
        />
        <SummaryMetric label="ESG records" value={summary?.esgRecordsAdded ?? 0} />
        <SummaryMetric
          label="Transaction records"
          value={summary?.transactionRecordsAdded ?? 0}
        />
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="surface-subtle px-4 py-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--primary)]">
        {label}
      </p>
      <p className="mono mt-2 text-2xl font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
