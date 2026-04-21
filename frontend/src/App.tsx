import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { DocumentIngestionPage } from "./features/documents/pages/DocumentIngestionPage";
import { OverviewDashboardPage } from "./features/overview-dashboard/pages/OverviewDashboardPage";
import { DueDiligencePage } from "./features/risk-monitoring/pages/DueDiligencePage";
import { RiskMonitoringPage } from "./features/risk-monitoring/pages/RiskMonitoringPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DocumentIngestionPage />} />
        <Route path="/overview-dashboard" element={<OverviewDashboardPage />} />
        <Route path="/risk-monitoring" element={<RiskMonitoringPage />} />
        <Route path="/due-diligence" element={<DueDiligencePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
