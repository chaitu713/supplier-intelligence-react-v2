import { ApiError } from "../../../api/client";
import { RiskHistogramChart } from "../components/RiskHistogramChart";
import { RiskSegmentationChart } from "../components/RiskSegmentationChart";
import { TopRiskSuppliersChart } from "../components/TopRiskSuppliersChart";
import { KpiCard } from "../../overview-dashboard/components/KpiCard";
import {
  useRiskDistribution,
  useRiskOverview,
  useRiskSegmentation,
  useTopRiskSuppliers,
} from "../hooks/useRiskMonitoring";

export function RiskMonitoringPage() {
  const overviewQuery = useRiskOverview();
  const distributionQuery = useRiskDistribution();
  const segmentationQuery = useRiskSegmentation();
  const topSuppliersQuery = useTopRiskSuppliers();

  const errorMessage = getErrorMessage(
    overviewQuery.error ??
      distributionQuery.error ??
      segmentationQuery.error ??
      topSuppliersQuery.error,
  );

  const overview = overviewQuery.data;

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header px-8 py-8">
          <p className="eyebrow text-sm">
            Risk Monitoring
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Identify, segment, and investigate supplier risk exposure
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            This page mirrors the Streamlit risk view with supplier risk KPIs,
            distribution charts, top-risk suppliers, and due diligence analysis.
          </p>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="High Risk"
            value={overview ? overview.highRiskCount.toLocaleString() : "-"}
            subtitle="Score > 8"
            accentClassName="bg-amber-500"
          />
          <KpiCard
            label="Medium Risk"
            value={overview ? overview.mediumRiskCount.toLocaleString() : "-"}
            subtitle="Score 5-8"
            accentClassName="bg-yellow-400"
          />
          <KpiCard
            label="Low Risk"
            value={overview ? overview.lowRiskCount.toLocaleString() : "-"}
            subtitle="Score <= 5"
            accentClassName="bg-emerald-600"
          />
          <KpiCard
            label="Avg Risk Score"
            value={overview ? overview.avgRiskScore.toFixed(2) : "-"}
            subtitle="Fleet average"
            accentClassName="bg-[var(--primary)]"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <RiskHistogramChart
            bins={distributionQuery.data ?? []}
            isLoading={distributionQuery.isLoading}
          />
          <RiskSegmentationChart
            items={segmentationQuery.data ?? []}
            isLoading={segmentationQuery.isLoading}
          />
        </section>

        <TopRiskSuppliersChart
          items={topSuppliersQuery.data ?? []}
          isLoading={topSuppliersQuery.isLoading}
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

  return "Something went wrong while loading risk analytics.";
}
