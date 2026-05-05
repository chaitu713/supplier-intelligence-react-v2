import type { CSSProperties } from "react";
import { useState } from "react";

import { AuditingWorkspace } from "./AuditingWorkspaceV2";
import OnboardingPage from "./OnboardingPageComponent";
import { TraceabilityWorkspace } from "./TraceabilityWorkspace";

const engagementTabs = [
  {
    id: "onboarding",
    label: "Onboarding",
    title: "Supplier onboarding",
    description: "Document-guided supplier intake into the v2 data model.",
  },
  {
    id: "auditing",
    label: "Auditing",
    title: "AI assisted auditing",
    description: "Audit review, findings analysis, and corrective action flow.",
  },
  {
    id: "traceability",
    label: "Traceability",
    title: "AI assisted traceability",
    description: "Lineage, origin visibility, and traceability gap detection.",
  },
] as const;

export function SupplierEngagementPage() {
  const [activeTab, setActiveTab] = useState<(typeof engagementTabs)[number]["id"]>("onboarding");

  return (
    <div style={styles.page}>
      <section style={styles.moduleBar}>
        <div style={styles.moduleMeta}>
          <span style={styles.eyebrow}>Supplier Engagement</span>
          <p style={styles.caption}>One parent module for onboarding, auditing, and traceability.</p>
        </div>

        <div style={styles.tabRail}>
          {engagementTabs.map((tab) => {
            const active = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.tab,
                  ...(active ? styles.tabActive : {}),
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section style={activeTab === "onboarding" ? styles.modulePaneActive : styles.modulePaneHidden}>
        <OnboardingPage embedded />
      </section>
      <section style={activeTab === "auditing" ? styles.modulePaneActive : styles.modulePaneHidden}>
        <AuditingWorkspace />
      </section>
      <section style={activeTab === "traceability" ? styles.modulePaneActive : styles.modulePaneHidden}>
        <TraceabilityWorkspace />
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: "18px",
    padding: "8px 0 36px",
  },
  moduleBar: {
    display: "grid",
    gap: "12px",
    paddingBottom: "8px",
  },
  moduleMeta: {
    display: "grid",
    gap: "4px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#166534",
  },
  caption: {
    margin: 0,
    color: "#61705d",
    fontSize: "0.92rem",
  },
  tabRail: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #dfe7dd",
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(17,22,18,0.04)",
  },
  tab: {
    minHeight: "38px",
    padding: "8px 14px",
    borderRadius: "6px",
    border: "1px solid transparent",
    background: "transparent",
    color: "#40503d",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    boxShadow: "none",
    transition: "background 0.16s ease, color 0.16s ease, border-color 0.16s ease",
  },
  tabActive: {
    color: "#ffffff",
    background: "#166534",
    borderColor: "#166534",
  },
  modulePaneActive: {
    display: "block",
  },
  modulePaneHidden: {
    display: "none",
  },
  placeholder: {
    display: "grid",
    gap: "8px",
    padding: "22px 24px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    boxShadow: "0 10px 24px rgba(17, 22, 18, 0.05)",
  },
  placeholderTitle: {
    margin: 0,
    fontSize: "1.45rem",
    color: "#101913",
  },
  placeholderText: {
    margin: 0,
    color: "#5a6957",
  },
};
