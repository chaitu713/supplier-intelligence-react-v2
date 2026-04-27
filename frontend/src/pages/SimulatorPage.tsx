export function SimulatorPage() {
  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header px-8 py-8">
          <p className="eyebrow text-sm">Simulator</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Scenario planning for supplier risk and resilience
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            This page will be used for what-if simulations such as supplier disruption,
            certification lapse, and risk movement scenarios.
          </p>
        </header>

        <section className="surface-card px-8 py-10">
          <h2 className="text-xl font-semibold text-[var(--text)]">Phase 1 Placeholder</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            We have created the top-level product structure first. The scenario builder
            and impact comparison panels will be added here in the next phase.
          </p>
        </section>
      </div>
    </div>
  );
}
