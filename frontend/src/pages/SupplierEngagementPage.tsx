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
    gap: "24px",
    padding: "16px 0 42px",
  },
  moduleBar: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: "18px",
    padding: "0 0 4px",
    flexWrap: "wrap",
  },
  moduleMeta: {
    display: "grid",
    gap: "6px",
    minWidth: "240px",
    maxWidth: "520px",
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
    fontSize: "0.94rem",
    lineHeight: 1.55,
  },
  tabRail: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    alignItems: "center",
    gap: "4px",
    width: "min(100%, 620px)",
    padding: "4px",
    borderRadius: "14px",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    background: "linear-gradient(180deg, #ffffff 0%, #f9fbf9 100%)",
    boxShadow: "0 1px 3px rgba(17,22,18,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
    overflowX: "auto",
  },
  tab: {
    minHeight: "38px",
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid transparent",
    background: "transparent",
    color: "#40503d",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    whiteSpace: "nowrap",
    boxShadow: "none",
    transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  tabActive: {
    color: "#ffffff",
    background: "linear-gradient(180deg, #1a7a3e 0%, #166534 100%)",
    borderColor: "#14532d",
    boxShadow: "0 2px 8px rgba(22, 101, 52, 0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  modulePaneActive: {
    display: "block",
    minWidth: 0,
    animation: "fade-in 0.3s ease-out both",
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
