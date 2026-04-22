import type { RiskSupplierItem } from "../../../api/risk";
import { PlotlyChart } from "../../../components/common/PlotlyChart";

interface TopRiskSuppliersChartProps {
  items: RiskSupplierItem[];
  isLoading: boolean;
}

export function TopRiskSuppliersChart({
  items,
  isLoading,
}: TopRiskSuppliersChartProps) {
  const maxValue = Math.max(...items.map((item) => item.overallRiskScore), 1);

  if (!isLoading) {
    if (items.length === 0) {
      return (
        <section className="surface-card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[var(--text)]">Top 10 High-Risk Suppliers</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Highest-risk suppliers ranked by overall risk score.
            </p>
          </div>
          <div className="empty-state px-6 py-16 text-center text-sm">
            No top-risk supplier data available yet.
          </div>
        </section>
      );
    }

    return (
      <section className="surface-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-[var(--text)]">Top 10 High-Risk Suppliers</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Highest-risk suppliers ranked by overall risk score.
          </p>
        </div>
        <PlotlyChart
          className="h-[420px]"
          data={[
            {
              type: "bar",
              orientation: "h",
              y: items.map((item) => item.supplierName).reverse(),
              x: items.map((item) => item.overallRiskScore).reverse(),
              marker: {
                color: "#166534",
                line: { color: "#bbf7d0", width: 1 },
              },
              customdata: items
                .map((item) => [
                  item.country ?? "Unknown",
                  item.tier ?? "Unspecified tier",
                  item.operationalRiskScore,
                  item.esgRiskScore,
                ])
                .reverse(),
              hovertemplate:
                "%{y}<br>Overall risk %{x:.2f}<br>%{customdata[0]}<br>%{customdata[1]}<br>Operational %{customdata[2]:.2f}<br>ESG %{customdata[3]:.2f}<extra></extra>",
            },
          ]}
          layout={{
            margin: { l: 170, r: 24, t: 8, b: 36 },
            xaxis: {
              title: { text: "Overall risk score" },
              gridcolor: "#dbeafe",
              zerolinecolor: "#dbeafe",
            },
            yaxis: {
              automargin: true,
            },
          }}
        />
      </section>
    );
  }

  return (
    <section className="surface-card p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text)]">Top 10 High-Risk Suppliers</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Highest-risk suppliers ranked by overall risk score.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.supplierId}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{item.supplierName}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {[item.country, item.category].filter(Boolean).join(" • ")}
                  </p>
                </div>
                <span className="mono text-sm font-semibold text-[var(--text-secondary)]">
                  {item.overallRiskScore.toFixed(2)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--border)]">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-[var(--primary)] to-[#4ade80]"
                  style={{ width: `${(item.overallRiskScore / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
