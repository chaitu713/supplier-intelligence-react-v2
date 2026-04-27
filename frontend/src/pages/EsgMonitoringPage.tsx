export function EsgMonitoringPage() {
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
            <p className="eyebrow text-sm">ESG Monitoring</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              Continuous ESG indicator monitoring across supplier health
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
              This page is reserved for supplier-level ESG indicator monitoring across
              BWS, HRR, land-use pressure, deterioration watchlists, and future ML-based
              ESG health signals.
            </p>
          </div>
        </header>

        <section className="visual-card p-8">
          <div className="visual-header">
            <h2 className="visual-title">Planned Scope</h2>
            <p className="visual-description">
              ESG Monitoring will become the dedicated workspace for indicator management
              rather than merging that functionality into Executive Dashboard or Analytics.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="visual-card-soft p-5">
              <p className="eyebrow">Indicator View</p>
              <p className="mt-3 text-base font-semibold text-[var(--text)]">
                BWS, HRR, and Land Use tracking
              </p>
            </div>
            <div className="visual-card-soft p-5">
              <p className="eyebrow">Watchlists</p>
              <p className="mt-3 text-base font-semibold text-[var(--text)]">
                Suppliers with worsening ESG indicators
              </p>
            </div>
            <div className="visual-card-soft p-5">
              <p className="eyebrow">Trend Signals</p>
              <p className="mt-3 text-base font-semibold text-[var(--text)]">
                Continuous monthly health movement
              </p>
            </div>
            <div className="visual-card-soft p-5">
              <p className="eyebrow">ML Layer</p>
              <p className="mt-3 text-base font-semibold text-[var(--text)]">
                Anomaly detection and deterioration prediction
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
