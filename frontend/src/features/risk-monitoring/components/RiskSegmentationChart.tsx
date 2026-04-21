import type { RiskSegmentationItem } from "../../../api/risk";
import { PlotlyChart } from "../../../components/common/PlotlyChart";

interface RiskSegmentationChartProps {
  items: RiskSegmentationItem[];
  isLoading: boolean;
}

const colors: Record<string, string> = {
  High: "#e11d48",
  Medium: "#facc15",
  Low: "#059669",
};

export function RiskSegmentationChart({
  items,
  isLoading,
}: RiskSegmentationChartProps) {
  const total = items.reduce((sum, item) => sum + item.supplierCount, 0);

  return (
    <section className="surface-card p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text)]">Risk Segmentation</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Supplier mix by high, medium, and low operational risk.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-6 animate-pulse rounded-full bg-slate-100" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state px-6 py-16 text-center text-sm">
          No risk segmentation data available yet.
        </div>
      ) : (
        <PlotlyChart
          className="h-[320px]"
          data={[
            {
              type: "pie",
              labels: items.map((item) => item.riskLevel),
              values: items.map((item) => item.supplierCount),
              hole: 0.58,
              marker: {
                colors: items.map((item) => colors[item.riskLevel]),
                line: { color: "#ffffff", width: 4 },
              },
              textinfo: "label+percent",
              textposition: "outside",
              hovertemplate: "%{label}: %{value} suppliers<extra></extra>",
            },
          ]}
          layout={{
            showlegend: false,
            margin: { l: 24, r: 24, t: 12, b: 12 },
            annotations: [
              {
                text: `${total}`,
                x: 0.5,
                y: 0.52,
                showarrow: false,
                font: { size: 26, color: "#0f172a" },
              },
              {
                text: "Suppliers",
                x: 0.5,
                y: 0.43,
                showarrow: false,
                font: { size: 12, color: "#64748b" },
              },
            ],
          }}
        />
      )}
    </section>
  );
}
