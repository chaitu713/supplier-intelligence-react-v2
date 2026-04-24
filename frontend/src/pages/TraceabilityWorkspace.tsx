import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

const TRACE_TABS = [
  { id: "overview", step: "01", label: "Trace Overview" },
  { id: "trace-view", step: "02", label: "Supplier / Commodity Trace" },
  { id: "insights", step: "03", label: "AI Trace Insights" },
] as const;

const SAMPLE_SUPPLIER_TRACE_ROWS = [
  {
    supplierId: 2001,
    supplierName: "Supplier_2001",
    country: "Indonesia",
    commodities: [
      { name: "Cocoa", riskLevel: "High", deforestationRisk: 0.61, volume: 305.11 },
      { name: "Coffee", riskLevel: "Medium", deforestationRisk: 0.4, volume: 178.73 },
      { name: "Rubber", riskLevel: "High", deforestationRisk: 0.87, volume: 304.58 },
    ],
    certifications: [
      { name: "ISO14001", expiryState: "Expired" },
      { name: "GMP", expiryState: "Expired" },
      { name: "Fairtrade", expiryState: "Expired" },
    ],
  },
  {
    supplierId: 2002,
    supplierName: "Supplier_2002",
    country: "USA",
    commodities: [
      { name: "Soya", riskLevel: "High", deforestationRisk: 0.83, volume: 191.81 },
      { name: "Rubber", riskLevel: "High", deforestationRisk: 0.87, volume: 957.81 },
    ],
    certifications: [
      { name: "PEFC", expiryState: "Expiring soon" },
      { name: "FSC", expiryState: "Expiring soon" },
      { name: "ISO22000", expiryState: "Valid" },
    ],
  },
  {
    supplierId: 2003,
    supplierName: "Supplier_2003",
    country: "Brazil",
    commodities: [
      { name: "Palm Oil", riskLevel: "High", deforestationRisk: 0.8, volume: 616.8 },
      { name: "Coffee", riskLevel: "Medium", deforestationRisk: 0.4, volume: 414.09 },
    ],
    certifications: [
      { name: "Rainforest Alliance", expiryState: "Valid" },
      { name: "FSC", expiryState: "Valid" },
      { name: "ISO14001", expiryState: "Pending" },
    ],
  },
  {
    supplierId: 2005,
    supplierName: "Supplier_2005",
    country: "Vietnam",
    commodities: [
      { name: "Rubber", riskLevel: "High", deforestationRisk: 0.87, volume: 634.94 },
      { name: "Cocoa", riskLevel: "High", deforestationRisk: 0.61, volume: 978.39 },
    ],
    certifications: [
      { name: "Fairtrade", expiryState: "Expired" },
      { name: "PEFC", expiryState: "Expiring soon" },
      { name: "HACCP", expiryState: "Expiring soon" },
    ],
  },
  {
    supplierId: 2006,
    supplierName: "Supplier_2006",
    country: "USA",
    commodities: [
      { name: "Rubber", riskLevel: "High", deforestationRisk: 0.87, volume: 184.22 },
      { name: "Wood", riskLevel: "Medium", deforestationRisk: 0.34, volume: 158.83 },
      { name: "Coffee", riskLevel: "Medium", deforestationRisk: 0.4, volume: 506.56 },
    ],
    certifications: [
      { name: "RSPO", expiryState: "Valid" },
      { name: "ISO14001", expiryState: "Valid" },
    ],
  },
  {
    supplierId: 2007,
    supplierName: "Supplier_2007",
    country: "Indonesia",
    commodities: [
      { name: "Coffee", riskLevel: "Medium", deforestationRisk: 0.4, volume: 959.69 },
      { name: "Cocoa", riskLevel: "High", deforestationRisk: 0.61, volume: 474.21 },
    ],
    certifications: [
      { name: "FSC", expiryState: "Valid" },
      { name: "Rainforest Alliance", expiryState: "Pending" },
    ],
  },
] as const;

const TRACE_FILTERS = ["All suppliers", "High-risk commodities", "Gaps to review"] as const;

export function TraceabilityWorkspace() {
  const [activeTab, setActiveTab] = useState<(typeof TRACE_TABS)[number]["id"]>("overview");
  const [activeFilter, setActiveFilter] = useState<(typeof TRACE_FILTERS)[number]>("All suppliers");
  const [traceRows, setTraceRows] = useState<Array<(typeof SAMPLE_SUPPLIER_TRACE_ROWS)[number]>>(
    [...SAMPLE_SUPPLIER_TRACE_ROWS],
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(
    SAMPLE_SUPPLIER_TRACE_ROWS[0].supplierId,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await fetch("http://localhost:8000/traceability/workspace");
        if (!response.ok) {
          throw new Error("Failed to load traceability workspace.");
        }
        const result = await response.json();
        if (!cancelled && Array.isArray(result?.suppliers) && result.suppliers.length > 0) {
          setTraceRows(result.suppliers);
          setSelectedSupplierId((current) =>
            result.suppliers.some((row: { supplierId: number }) => row.supplierId === current)
              ? current
              : result.suppliers[0].supplierId,
          );
        }
      } catch {
        if (!cancelled) {
          setTraceRows([...SAMPLE_SUPPLIER_TRACE_ROWS]);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(() => {
    if (activeFilter === "High-risk commodities") {
      return traceRows.filter((row) =>
        row.commodities.some((commodity) => commodity.riskLevel === "High"),
      );
    }
    if (activeFilter === "Gaps to review") {
      return traceRows.filter((row) =>
        row.certifications.some((cert) => cert.expiryState === "Expired" || cert.expiryState === "Pending"),
      );
    }
    return traceRows;
  }, [activeFilter, traceRows]);

  const selectedSupplier =
    visibleRows.find((row) => row.supplierId === selectedSupplierId) ??
    traceRows.find((row) => row.supplierId === selectedSupplierId) ??
    visibleRows[0] ??
    traceRows[0];

  const commodityCoverage = useMemo(() => {
    const map = new Map<string, { suppliers: number; countries: Set<string>; riskLevel: string }>();

    traceRows.forEach((row) => {
      row.commodities.forEach((commodity) => {
        const current = map.get(commodity.name) ?? {
          suppliers: 0,
          countries: new Set<string>(),
          riskLevel: commodity.riskLevel,
        };
        current.suppliers += 1;
        current.countries.add(row.country);
        map.set(commodity.name, current);
      });
    });

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      suppliers: value.suppliers,
      countries: value.countries.size,
      riskLevel: value.riskLevel,
    }));
  }, [traceRows]);

  const expiredCount = selectedSupplier.certifications.filter((cert) => cert.expiryState === "Expired").length;
  const pendingCount = selectedSupplier.certifications.filter((cert) => cert.expiryState === "Pending").length;
  const highRiskCommodityCount = selectedSupplier.commodities.filter(
    (commodity) => commodity.riskLevel === "High",
  ).length;
  const traceConfidence =
    expiredCount > 0 ? "Needs evidence refresh" : pendingCount > 0 ? "Partial trace confidence" : "Strong current trace";

  function renderOverview() {
    const highRiskSuppliers = traceRows.filter((row) =>
      row.commodities.some((commodity) => commodity.riskLevel === "High"),
    ).length;
    const gapSuppliers = traceRows.filter((row) =>
      row.certifications.some((cert) => cert.expiryState === "Expired" || cert.expiryState === "Pending"),
    ).length;

    return (
      <div style={styles.stack}>
        <section style={styles.flowBanner}>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Suppliers mapped</span>
            <strong style={styles.flowBannerValue}>{traceRows.length}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Commodity families</span>
            <strong style={styles.flowBannerValue}>{commodityCoverage.length}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>High-risk suppliers</span>
            <strong style={styles.flowBannerValue}>{highRiskSuppliers}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Trace gaps</span>
            <strong style={styles.flowBannerValue}>{gapSuppliers}</strong>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Trace overview</h2>
              <p style={styles.sectionText}>
                This module shows how current supplier, commodity, country, and certification mappings combine into a practical traceability view.
              </p>
            </div>
            <span style={styles.pill}>{activeFilter}</span>
          </div>

          <div style={styles.selectorGrid}>
            <div style={styles.field}>
              <label htmlFor="trace-supplier-select" style={styles.label}>
                Supplier selector
              </label>
              <select
                id="trace-supplier-select"
                value={selectedSupplier.supplierId}
                onChange={(event) => setSelectedSupplierId(Number(event.target.value))}
                style={styles.selectInput}
              >
                {visibleRows.map((row) => (
                  <option key={row.supplierId} value={row.supplierId}>
                    {row.supplierName} ({row.country})
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.selectorInfoCard}>
              <span style={styles.selectorInfoLabel}>Current selection</span>
              <strong style={styles.selectorInfoValue}>{selectedSupplier.supplierName}</strong>
              <span style={styles.selectorInfoMeta}>
                {selectedSupplier.country} · {selectedSupplier.commodities.length} commodities ·{" "}
                {selectedSupplier.certifications.length} certifications
              </span>
            </div>
          </div>

          <div style={styles.filterRail}>
            {TRACE_FILTERS.map((filter) => (
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

          <div style={styles.traceSummaryCard}>
            <div style={styles.traceCardHead}>
              <strong style={styles.traceCardTitle}>{selectedSupplier.supplierName}</strong>
              <span style={styles.traceCardCountry}>{selectedSupplier.country}</span>
            </div>
            <div style={styles.traceCardMeta}>
              <span>{selectedSupplier.commodities.length} commodities</span>
              <span>{selectedSupplier.certifications.length} certifications</span>
            </div>
            <div style={styles.traceChipRail}>
              {selectedSupplier.commodities.map((commodity) => (
                <span key={commodity.name} style={styles.traceChip}>
                  {commodity.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Commodity coverage</h2>
              <p style={styles.sectionText}>
                Commodity view derived from supplier-to-commodity mappings, with country spread and risk context.
              </p>
            </div>
          </div>

          <div style={styles.historyList}>
            {commodityCoverage.map((commodity) => (
              <div key={commodity.name} style={styles.historyRow}>
                <div style={styles.historyPrimary}>
                  <strong style={styles.queueName}>{commodity.name}</strong>
                  <span style={styles.queueMeta}>{commodity.countries} sourcing countries</span>
                </div>
                <span style={styles.historyMetric}>{commodity.suppliers} suppliers</span>
                <span style={styles.historyMetric}>{commodity.riskLevel} risk</span>
                <span
                  style={{
                    ...styles.statusBadge,
                    ...getRiskBadgeStyle(commodity.riskLevel),
                  }}
                >
                  {commodity.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderTraceView() {
    return (
      <div style={styles.stack}>
        <section style={styles.flowBanner}>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Selected supplier</span>
            <strong style={styles.flowBannerValue}>{selectedSupplier.supplierName}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Country of operation</span>
            <strong style={styles.flowBannerValue}>{selectedSupplier.country}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>High-risk commodities</span>
            <strong style={styles.flowBannerValue}>{highRiskCommodityCount}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Trace confidence</span>
            <strong style={styles.flowBannerValue}>{traceConfidence}</strong>
          </div>
        </section>

        <section style={styles.reviewGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Supplier trace view</h2>
                <p style={styles.sectionText}>
                  Supplier-level trace combines commodity footprint, country anchor, and certification-backed confidence.
                </p>
              </div>
              <span style={styles.pillAlt}>Supplier #{selectedSupplier.supplierId}</span>
            </div>

            <div style={styles.summaryGrid}>
              <ReviewItem label="Supplier" value={selectedSupplier.supplierName} />
              <ReviewItem label="Country" value={selectedSupplier.country} />
              <ReviewItem label="Commodity count" value={String(selectedSupplier.commodities.length)} />
              <ReviewItem label="Certification count" value={String(selectedSupplier.certifications.length)} />
              <ReviewItem label="Expired certificates" value={String(expiredCount)} />
              <ReviewItem label="Pending certificates" value={String(pendingCount)} />
            </div>

            <div style={styles.noteCard}>
              <strong style={styles.noteTitle}>Trace summary</strong>
              <p style={styles.noteText}>
                {selectedSupplier.supplierName} currently traces to {selectedSupplier.commodities.length} mapped commodities in {selectedSupplier.country}. Certification status determines how strong that trace picture looks today.
              </p>
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Commodity footprint</h2>
                  <p style={styles.sectionText}>
                    Commodity-level trace with risk context from your existing commodity master.
                  </p>
                </div>
              </div>

              <div style={styles.certList}>
                {selectedSupplier.commodities.map((commodity) => (
                  <div key={commodity.name} style={styles.certListItem}>
                    <div>
                      <strong style={styles.certListName}>{commodity.name}</strong>
                      <div style={styles.certListMeta}>
                        Volume {commodity.volume.toFixed(2)} · Deforestation {commodity.deforestationRisk.toFixed(2)}
                      </div>
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...getRiskBadgeStyle(commodity.riskLevel),
                      }}
                    >
                      {commodity.riskLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Certification-backed trace</h2>
                  <p style={styles.sectionText}>
                    Traceability confidence is supported or weakened by the supplier’s current certification posture.
                  </p>
                </div>
              </div>

              <div style={styles.certList}>
                {selectedSupplier.certifications.map((cert) => (
                  <div key={cert.name} style={styles.certListItem}>
                    <div>
                      <strong style={styles.certListName}>{cert.name}</strong>
                      <div style={styles.certListMeta}>Trace support state</div>
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(cert.expiryState === "Expired"
                          ? styles.statusBadgeHigh
                          : cert.expiryState === "Pending"
                            ? styles.statusBadgeSoon
                            : styles.statusBadgeVerified),
                      }}
                    >
                      {cert.expiryState}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderInsights() {
    const summary =
      expiredCount > 0
        ? `${selectedSupplier.supplierName} has mapped commodity trace coverage, but expired certifications reduce confidence in the current trace posture.`
        : pendingCount > 0
          ? `${selectedSupplier.supplierName} has a usable trace view, but pending certifications leave some trace confidence gaps open.`
          : `${selectedSupplier.supplierName} shows a comparatively strong traceability posture across mapped commodities and current certifications.`;

    const keyConcerns = [
      expiredCount > 0
        ? `${expiredCount} expired certifications weaken current trace confidence.`
        : "No expired certifications are currently weakening the trace view.",
      highRiskCommodityCount > 0
        ? `${highRiskCommodityCount} mapped commodities are classified as high risk.`
        : "Mapped commodities are not concentrated in the highest risk category.",
      `Trace is currently anchored at supplier-country-commodity level, not deeper site or batch level.`,
    ];

    const nextActions = [
      expiredCount > 0 ? "Request refreshed certification evidence for expired coverage." : "Maintain current trace evidence and recheck periodically.",
      pendingCount > 0 ? "Resolve pending certifications before treating the trace as fully supported." : "Use current certification support as part of trace review.",
      highRiskCommodityCount > 0 ? "Prioritize high-risk commodity suppliers for deeper trace follow-up later." : "Keep this supplier in normal trace monitoring.",
    ];

    const suggestedDecision =
      expiredCount > 0 ? "Trace gaps need follow-up" : pendingCount > 0 ? "Partial trace confidence" : "Trace posture acceptable";

    return (
      <div style={styles.stack}>
        <section style={styles.flowBanner}>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Trace confidence</span>
            <strong style={styles.flowBannerValue}>{traceConfidence}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Expired support</span>
            <strong style={styles.flowBannerValue}>{expiredCount}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Pending support</span>
            <strong style={styles.flowBannerValue}>{pendingCount}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Suggested decision</span>
            <strong style={styles.flowBannerValue}>{suggestedDecision}</strong>
          </div>
        </section>

        <section style={styles.reviewGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>AI trace summary</h2>
                <p style={styles.sectionText}>
                  A grounded interpretation of the selected supplier’s trace picture using supplier-country-commodity mappings and certification-backed context.
                </p>
              </div>
              <span style={styles.pillAlt}>Current v2 mapping logic</span>
            </div>

            <div style={styles.noteCard}>
              <strong style={styles.noteTitle}>Summary</strong>
              <p style={styles.noteText}>{summary}</p>
            </div>

            <div style={styles.insightGrid}>
              <div style={styles.insightCard}>
                <strong style={styles.insightTitle}>Key trace concerns</strong>
                <ul style={styles.insightList}>
                  {keyConcerns.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div style={styles.insightCard}>
                <strong style={styles.insightTitle}>Why this is still useful</strong>
                <ul style={styles.insightList}>
                  <li>It gives supplier-to-commodity-to-country visibility immediately.</li>
                  <li>It shows where certification-backed confidence is weak.</li>
                  <li>It highlights which suppliers deserve deeper trace follow-up later.</li>
                </ul>
              </div>
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Suggested next actions</h2>
                  <p style={styles.sectionText}>Practical follow-up steps for the current trace view.</p>
                </div>
              </div>

              <div style={styles.actionList}>
                {nextActions.map((action) => (
                  <div key={action} style={styles.actionItem}>
                    <span style={styles.actionDot} />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Decision support</h2>
                  <p style={styles.sectionText}>
                    This is a traceability interpretation layer, not a full chain-of-custody verification engine.
                  </p>
                </div>
              </div>

              <div style={styles.summaryGrid}>
                <ReviewItem label="Suggested decision" value={suggestedDecision} />
                <ReviewItem label="High-risk commodities" value={String(highRiskCommodityCount)} />
                <ReviewItem label="Expired certifications" value={String(expiredCount)} />
                <ReviewItem label="Pending certifications" value={String(pendingCount)} />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={styles.stack}>
      <section style={styles.embeddedFrame}>
        <div style={styles.tabRail}>
          {TRACE_TABS.map((tab) => {
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

      {activeTab === "overview"
        ? renderOverview()
        : activeTab === "trace-view"
          ? renderTraceView()
          : renderInsights()}
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
  pill: { padding: "8px 12px", borderRadius: "999px", background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0", fontSize: "12px", fontWeight: 700 },
  pillAlt: { padding: "8px 12px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: "12px", fontWeight: 700 },
  filterRail: { display: "flex", flexWrap: "wrap", gap: "10px" },
  selectorGrid: { display: "grid", gridTemplateColumns: "minmax(280px, 1.2fr) minmax(240px, 0.8fr)", gap: "14px" },
  field: { display: "grid", gap: "8px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#1d2a1f" },
  selectInput: {
    width: "100%",
    minHeight: "46px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(17, 22, 18, 0.14)",
    background: "#fff",
    color: "#152117",
    fontSize: "14px",
  },
  selectorInfoCard: {
    display: "grid",
    gap: "4px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(246,250,246,0.96), rgba(255,255,255,0.98))",
    border: "1px solid rgba(17, 22, 18, 0.08)",
  },
  selectorInfoLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  selectorInfoValue: { color: "#152117", fontSize: "15px" },
  selectorInfoMeta: { color: "#61705d", fontSize: "13px" },
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
  traceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" },
  traceCard: {
    display: "grid",
    gap: "12px",
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))",
    cursor: "pointer",
    textAlign: "left",
  },
  traceSummaryCard: {
    display: "grid",
    gap: "12px",
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))",
  },
  traceCardActive: {
    borderColor: "rgba(22, 101, 52, 0.2)",
    boxShadow: "0 10px 24px rgba(22, 101, 52, 0.08)",
    background: "linear-gradient(180deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))",
  },
  traceCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  traceCardTitle: { color: "#101913", fontSize: "15px" },
  traceCardCountry: { color: "#5f705f", fontSize: "13px" },
  traceCardMeta: { display: "flex", gap: "12px", color: "#6a7a67", fontSize: "13px" },
  traceChipRail: { display: "flex", flexWrap: "wrap", gap: "8px" },
  traceChip: { padding: "6px 10px", borderRadius: "999px", background: "#f6f8f5", color: "#3b4a3a", fontSize: "12px", border: "1px solid rgba(17,22,18,0.08)" },
  reviewGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: "18px" },
  sideStack: { display: "grid", gap: "18px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" },
  reviewItem: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17, 22, 18, 0.08)" },
  summaryLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  summaryValue: { color: "#152117", fontSize: "15px" },
  noteCard: { display: "grid", gap: "8px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(240,253,244,0.92), rgba(255,255,255,0.98))", border: "1px solid rgba(134, 239, 172, 0.8)" },
  noteTitle: { color: "#14532d", fontSize: "15px" },
  noteText: { margin: 0, color: "#45624a", lineHeight: 1.6 },
  certList: { display: "grid", gap: "10px" },
  certListItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid rgba(17, 22, 18, 0.08)",
  },
  certListName: { color: "#101913", fontSize: "14px" },
  certListMeta: { marginTop: "4px", color: "#6a7a67", fontSize: "12px" },
  historyList: { display: "grid", gap: "10px" },
  historyRow: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 2fr) repeat(3, minmax(120px, 0.8fr))",
    gap: "14px",
    alignItems: "center",
    padding: "16px 18px",
    borderRadius: "18px",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))",
  },
  historyPrimary: { display: "grid", gap: "4px" },
  queueName: { fontSize: "15px", color: "#101913" },
  queueMeta: { fontSize: "12px", color: "#6a7a67" },
  historyMetric: { color: "#415240", fontSize: "14px" },
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
  statusBadgeHigh: { background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" },
  statusBadgeVerified: { background: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" },
  statusBadgeSoon: { background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" },
  insightGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" },
  insightCard: { display: "grid", gap: "10px", padding: "18px", borderRadius: "18px", background: "#fff", border: "1px solid rgba(17, 22, 18, 0.08)" },
  insightTitle: { color: "#101913", fontSize: "15px" },
  insightList: { margin: 0, paddingLeft: "18px", color: "#4d5e4c", lineHeight: 1.6 },
  actionList: { display: "grid", gap: "10px" },
  actionItem: { display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 0", borderBottom: "1px solid rgba(17, 22, 18, 0.06)", color: "#415240" },
  actionDot: { width: "10px", height: "10px", marginTop: "5px", borderRadius: "999px", background: "#16a34a", flexShrink: 0 },
};

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.reviewItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function getRiskBadgeStyle(riskLevel: string) {
  if (riskLevel === "High") {
    return styles.statusBadgeHigh;
  }
  if (riskLevel === "Medium") {
    return styles.statusBadgeSoon;
  }
  return styles.statusBadgeVerified;
}
