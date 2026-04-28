import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

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

  const activeModule = useMemo(
    () => engagementTabs.find((tab) => tab.id === activeTab) ?? engagementTabs[0],
    [activeTab],
  );

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

      {activeTab === "onboarding" ? (
        <OnboardingPage embedded />
      ) : activeTab === "auditing" ? (
        <AuditingWorkspace />
      ) : activeTab === "traceability" ? (
        <TraceabilityWorkspace />
      ) : (
        <section style={styles.placeholder}>
          <h2 style={styles.placeholderTitle}>{activeModule.title}</h2>
          <p style={styles.placeholderText}>{activeModule.description}</p>
        </section>
      )}
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
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "18px",
    width: "100%",
    borderBottom: "1px solid rgba(17, 22, 18, 0.1)",
    paddingBottom: "4px",
    flexWrap: "wrap",
  },
  tab: {
    padding: "8px 12px 12px",
    borderRadius: 0,
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: "#778a71",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    boxShadow: "none",
    transition: "color 0.16s ease, border-color 0.16s ease",
  },
  tabActive: {
    color: "#166534",
    borderBottomColor: "#166534",
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
