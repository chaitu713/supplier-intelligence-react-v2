import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { ExecutiveDashboardPage } from "./features/executive-dashboard/pages/ExecutiveDashboardPage";
import { DueDiligencePage } from "./features/risk-monitoring/pages/DueDiligencePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { SupplierEngagementPage } from "./pages/SupplierEngagementPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/executive-dashboard" replace />} />
        <Route path="/executive-dashboard" element={<ExecutiveDashboardPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/supplier-engagement" element={<SupplierEngagementPage />} />
        <Route path="/due-diligence-agent" element={<DueDiligencePage />} />
        <Route path="/onboarding" element={<Navigate to="/supplier-engagement" replace />} />
        <Route path="/overview-dashboard" element={<Navigate to="/executive-dashboard" replace />} />
        <Route path="/risk-monitoring" element={<Navigate to="/analytics" replace />} />
        <Route path="/due-diligence" element={<Navigate to="/due-diligence-agent" replace />} />
        <Route path="*" element={<Navigate to="/executive-dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
