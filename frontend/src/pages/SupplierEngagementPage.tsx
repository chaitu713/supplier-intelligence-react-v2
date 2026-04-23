import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import OnboardingPage from "./OnboardingPage.jsx";

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
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    width: "100%",
  },
  tab: {
    width: "100%",
    padding: "14px 18px",
    borderRadius: "18px",
    border: "1px solid rgba(17, 22, 18, 0.12)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,248,0.9))",
    color: "#1f2b20",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(17, 22, 18, 0.04)",
    transition: "background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease",
  },
  tabActive: {
    background: "linear-gradient(135deg, #166534, #14532d)",
    color: "#ffffff",
    borderColor: "#166534",
    boxShadow: "0 12px 24px rgba(22, 101, 52, 0.16)",
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
