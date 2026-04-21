import type { DocumentHistoryItem } from "../../../api/documents";

interface ProcessingHistoryTableProps {
  items: DocumentHistoryItem[];
  isLoading: boolean;
}

export function ProcessingHistoryTable({
  items,
  isLoading,
}: ProcessingHistoryTableProps) {
  return (
    <section className="surface-card p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--text)]">Processing History</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Recent document ingestion activity from the backend.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Records</th>
              <th className="px-4 py-3 font-medium">Processed At</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>
                  <td className="px-4 py-4" colSpan={5}>
                    <div className="h-6 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <tr key={`${item.documentName}-${item.timestamp}`}>
                  <td className="px-4 py-4 text-sm font-medium text-[var(--text)]">
                    {item.documentName}
                  </td>
                  <td className="px-4 py-4 text-sm capitalize text-[var(--text-secondary)]">
                    {item.documentType}
                  </td>
                  <td className="px-4 py-4 text-sm text-[var(--text-secondary)]">{item.status}</td>
                  <td className="mono px-4 py-4 text-sm text-[var(--text-secondary)]">{item.recordsAdded}</td>
                  <td className="mono px-4 py-4 text-sm text-[var(--text-secondary)]">{item.timestamp}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-[var(--muted)]" colSpan={5}>
                  No ingestion history available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
