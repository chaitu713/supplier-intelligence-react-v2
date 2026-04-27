export function AnalyticsPage() {
  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header px-8 py-8">
          <p className="eyebrow text-sm">Analytics</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Detailed supplier, ESG, and risk breakdowns
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            This page will host the deeper charts, distributions, and drill-down analysis
            that sit behind the Executive Dashboard.
          </p>
        </header>

        <section className="surface-card px-8 py-10">
          <h2 className="text-xl font-semibold text-[var(--text)]">Phase 1 Placeholder</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            The Executive Dashboard is now the summary-first landing page. The detailed
            country, ESG, and risk visualizations will be moved and expanded here in the
            next phase.
          </p>
        </section>
      </div>
    </div>
  );
}
