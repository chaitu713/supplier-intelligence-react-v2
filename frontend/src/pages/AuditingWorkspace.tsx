import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

const AUDIT_TABS = [
  { id: "queue", step: "01", label: "Audit Queue" },
  { id: "review", step: "02", label: "Audit Review" },
  { id: "insights", step: "03", label: "AI Audit Insights" },
] as const;

const AUDIT_ROWS = [
  {
    auditId: 1,
    supplierId: 2001,
    supplierName: "Supplier_2001",
    country: "Indonesia",
    type: "External",
    auditDate: "2024-06-06",
    score: 80.14,
    nonCompliance: 4,
    status: "Needs attention",
    priority: "High",
  },
  {
    auditId: 6,
    supplierId: 2002,
    supplierName: "Supplier_2002",
    country: "USA",
    type: "Internal",
    auditDate: "2024-12-04",
    score: 89.68,
    nonCompliance: 5,
    status: "Needs attention",
    priority: "High",
  },
  {
    auditId: 11,
    supplierId: 2003,
    supplierName: "Supplier_2003",
    country: "Brazil",
    type: "External",
    auditDate: "2024-02-10",
    score: 99.92,
    nonCompliance: 5,
    status: "Monitor",
    priority: "Medium",
  },
  {
    auditId: 14,
    supplierId: 2004,
    supplierName: "Supplier_2004",
    country: "India",
    type: "External",
    auditDate: "2024-04-18",
    score: 72.45,
    nonCompliance: 2,
    status: "Open review",
    priority: "Medium",
  },
  {
    auditId: 18,
    supplierId: 2005,
    supplierName: "Supplier_2005",
    country: "Vietnam",
    type: "Internal",
    auditDate: "2024-03-03",
    score: 66.72,
    nonCompliance: 5,
    status: "Open review",
    priority: "High",
  },
  {
    auditId: 23,
    supplierId: 2007,
    supplierName: "Supplier_2007",
    country: "Indonesia",
    type: "External",
    auditDate: "2023-11-21",
    score: 91.2,
    nonCompliance: 1,
    status: "Reviewed",
    priority: "Low",
  },
] as const;

const FILTERS = ["All", "High priority", "Open review", "External"] as const;

export function AuditingWorkspace() {
  const [activeTab, setActiveTab] = useState<(typeof AUDIT_TABS)[number]["id"]>("queue");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selectedAuditId, setSelectedAuditId] = useState<number>(AUDIT_ROWS[0].auditId);

  const visibleRows = useMemo(() => {
    if (activeFilter === "High priority") {
      return AUDIT_ROWS.filter((row) => row.priority === "High");
    }
    if (activeFilter === "Open review") {
      return AUDIT_ROWS.filter((row) => row.status === "Open review");
    }
    if (activeFilter === "External") {
      return AUDIT_ROWS.filter((row) => row.type === "External");
    }
    return AUDIT_ROWS;
  }, [activeFilter]);

  const selectedAudit =
    visibleRows.find((row) => row.auditId === selectedAuditId) ??
    AUDIT_ROWS.find((row) => row.auditId === selectedAuditId) ??
    visibleRows[0] ??
    AUDIT_ROWS[0];

  function renderQueue() {
    return (
      <div style={styles.stack}>
        <section style={styles.flowBanner}>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Visible audits</span>
            <strong style={styles.flowBannerValue}>{visibleRows.length}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>High priority</span>
            <strong style={styles.flowBannerValue}>
              {AUDIT_ROWS.filter((row) => row.priority === "High").length}
            </strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Open review</span>
            <strong style={styles.flowBannerValue}>
              {AUDIT_ROWS.filter((row) => row.status === "Open review").length}
            </strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>No upload needed</span>
            <strong style={styles.flowBannerValue}>Existing v2 data</strong>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Audit queue</h2>
              <p style={styles.sectionText}>
                Start auditing from existing audit records, supplier master data, and certification
                mappings. No new supplier upload is required for this module.
              </p>
            </div>
            <span style={styles.pill}>{activeFilter}</span>
          </div>

          <div style={styles.filterRail}>
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                style={{
                  ...styles.filterChip,
                  ...(activeFilter === filter ? styles.filterChipActive : {}),
                }}
              >
                {filter}
              </button>
            ))}
          </div>

          <div style={styles.queueTable}>
            <div style={{ ...styles.queueRow, ...styles.queueHeader }}>
              <span>Supplier</span>
              <span>Type</span>
              <span>Audit Date</span>
              <span>Score</span>
              <span>Non-compliance</span>
              <span>Status</span>
            </div>

            {visibleRows.map((row) => {
              const selected = row.auditId === selectedAudit.auditId;
              return (
                <button
                  key={row.auditId}
                  type="button"
                  onClick={() => setSelectedAuditId(row.auditId)}
                  style={{
                    ...styles.queueRow,
                    ...(selected ? styles.queueRowActive : {}),
                  }}
                >
                  <div style={styles.queuePrimary}>
                    <strong style={styles.queueName}>{row.supplierName}</strong>
                    <span style={styles.queueMeta}>
                      {row.country} · #{row.supplierId}
                    </span>
                  </div>
                  <span>{row.type}</span>
                  <span>{row.auditDate}</span>
                  <span>{row.score.toFixed(2)}</span>
                  <span>{row.nonCompliance}</span>
                  <span>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(row.priority === "High" ? styles.statusBadgeHigh : {}),
                      }}
                    >
                      {row.status}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderPlaceholder(title: string, text: string) {
    return (
      <section style={styles.placeholder}>
        <span style={styles.placeholderEyebrow}>Next auditing step</span>
        <h2 style={styles.placeholderTitle}>{title}</h2>
        <p style={styles.placeholderText}>{text}</p>
      </section>
    );
  }

  return (
    <div style={styles.stack}>
      <section style={styles.embeddedFrame}>
        <div style={styles.tabRail}>
          {AUDIT_TABS.map((tab) => {
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
                <span style={styles.tabStep}>{tab.step}</span>
                <span style={styles.tabLabel}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "queue"
        ? renderQueue()
        : activeTab === "review"
          ? renderPlaceholder(
              "Audit review",
              `Next we will open the selected audit for ${selectedAudit.supplierName}, show supplier-level audit history, and add certification context from the existing v2 mappings.`,
            )
          : renderPlaceholder(
              "AI audit insights",
              `After review is in place, this tab will generate AI-assisted audit summaries, reviewer focus areas, and suggested next actions using the selected audit record and certification status.`,
            )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: "grid", gap: "22px" },
  embeddedFrame: { display: "grid", gap: "16px", padding: "0" },
  tabRail: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  tab: {
    display: "grid",
    gap: "6px",
    padding: "16px 18px",
    borderRadius: "18px",
    border: "1px solid rgba(17, 22, 18, 0.1)",
    background: "rgba(255,255,255,0.8)",
    textAlign: "left",
    cursor: "pointer",
    transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease",
  },
  tabActive: {
    background: "linear-gradient(135deg, #166534, #14532d)",
    borderColor: "#166534",
    boxShadow: "0 14px 28px rgba(22, 101, 52, 0.2)",
    color: "#fff",
  },
  tabStep: { fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" },
  tabLabel: { fontSize: "15px", fontWeight: 600 },
  flowBanner: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  flowBannerItem: {
    display: "grid",
    gap: "4px",
    padding: "16px 18px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,250,246,0.98))",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    boxShadow: "0 8px 20px rgba(17, 22, 18, 0.05)",
  },
  flowBannerLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#73826f" },
  flowBannerValue: { color: "#152117", fontSize: "1rem" },
  panel: {
    display: "grid",
    gap: "18px",
    width: "100%",
    minWidth: 0,
    padding: "24px",
    borderRadius: "28px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)",
  },
  sectionHead: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  sectionTitle: { margin: 0, fontSize: "1.3rem", color: "#101913" },
  sectionText: { marginTop: "6px", maxWidth: "760px", color: "#566753" },
  pill: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#ecfdf3",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: "12px",
    fontWeight: 700,
  },
  filterRail: { display: "flex", flexWrap: "wrap", gap: "10px" },
  filterChip: {
    padding: "9px 14px",
    borderRadius: "999px",
    border: "1px solid rgba(17, 22, 18, 0.1)",
    background: "#fff",
    color: "#2b372c",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  filterChipActive: {
    background: "#f0fdf4",
    borderColor: "#86efac",
    color: "#166534",
  },
  queueTable: { display: "grid", gap: "10px" },
  queueHeader: {
    background: "transparent",
    border: "none",
    boxShadow: "none",
    color: "#73826f",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "default",
  },
  queueRow: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 2fr) repeat(5, minmax(90px, 1fr))",
    gap: "14px",
    alignItems: "center",
    width: "100%",
    padding: "16px 18px",
    borderRadius: "20px",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))",
    textAlign: "left",
    color: "#1c261e",
    boxShadow: "0 6px 18px rgba(17, 22, 18, 0.04)",
    cursor: "pointer",
  },
  queueRowActive: {
    borderColor: "rgba(22, 101, 52, 0.2)",
    boxShadow: "0 10px 24px rgba(22, 101, 52, 0.08)",
    background: "linear-gradient(180deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))",
  },
  queuePrimary: { display: "grid", gap: "4px" },
  queueName: { fontSize: "15px", color: "#101913" },
  queueMeta: { fontSize: "12px", color: "#6a7a67" },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  statusBadgeHigh: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
  },
  placeholder: {
    display: "grid",
    gap: "10px",
    padding: "24px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    boxShadow: "0 10px 24px rgba(17, 22, 18, 0.05)",
  },
  placeholderEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#166534",
  },
  placeholderTitle: { margin: 0, fontSize: "1.6rem", color: "#101913" },
  placeholderText: { margin: 0, maxWidth: "820px", color: "#5a6957", lineHeight: 1.6 },
};
