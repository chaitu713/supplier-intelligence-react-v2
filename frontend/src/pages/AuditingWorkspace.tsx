import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

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

const SUPPLIER_PROFILES = {
  2001: {
    tier: "Tier 2",
    size: "Medium",
    annualRevenue: "$33.1M",
    status: "Active",
  },
  2002: {
    tier: "Tier 2",
    size: "Medium",
    annualRevenue: "$73.1M",
    status: "Active",
  },
  2003: {
    tier: "Tier 2",
    size: "Medium",
    annualRevenue: "$52.8M",
    status: "Active",
  },
  2004: {
    tier: "Tier 1",
    size: "Medium",
    annualRevenue: "$73.9M",
    status: "Active",
  },
  2005: {
    tier: "Tier 1",
    size: "Small",
    annualRevenue: "$17.4M",
    status: "Active",
  },
  2007: {
    tier: "Tier 2",
    size: "Medium",
    annualRevenue: "$43.3M",
    status: "Active",
  },
} as const;

const CERTIFICATION_CONTEXT = {
  2001: [
    { name: "ISO14001", status: "Pending", expiryDate: "2025-01-01" },
    { name: "GMP", status: "Pending", expiryDate: "2025-01-01" },
    { name: "Fairtrade", status: "Verified", expiryDate: "2025-01-01" },
  ],
  2002: [
    { name: "PEFC", status: "Pending", expiryDate: "2025-01-01" },
    { name: "FSC", status: "Pending", expiryDate: "2025-01-01" },
    { name: "ISO22000", status: "Verified", expiryDate: "2025-01-01" },
  ],
  2003: [
    { name: "Rainforest Alliance", status: "Verified", expiryDate: "2025-01-01" },
    { name: "FSC", status: "Pending", expiryDate: "2025-01-01" },
    { name: "ISO14001", status: "Pending", expiryDate: "2025-01-01" },
  ],
  2004: [
    { name: "GMP", status: "Pending", expiryDate: "2025-01-01" },
    { name: "FSC", status: "Verified", expiryDate: "2025-01-01" },
  ],
  2005: [
    { name: "FSC", status: "Pending", expiryDate: "2025-01-01" },
    { name: "Fairtrade", status: "Verified", expiryDate: "2025-01-01" },
  ],
  2007: [
    { name: "RSPO", status: "Verified", expiryDate: "2025-01-01" },
    { name: "HACCP", status: "Pending", expiryDate: "2025-01-01" },
  ],
} as const;

export function AuditingWorkspace() {
  const [activeTab, setActiveTab] = useState<(typeof AUDIT_TABS)[number]["id"]>("queue");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selectedAuditId, setSelectedAuditId] = useState<number>(AUDIT_ROWS[0].auditId);
  const [auditInsights, setAuditInsights] = useState<{
    summary: string;
    key_concerns: string[];
    reviewer_focus: string[];
    next_actions: string[];
    suggested_decision: string;
    confidence: string;
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");

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
  const supplierHistory = useMemo(
    () =>
      AUDIT_ROWS.filter((row) => row.supplierId === selectedAudit.supplierId).sort((a, b) =>
        b.auditDate.localeCompare(a.auditDate),
      ),
    [selectedAudit],
  );
  const profile =
    SUPPLIER_PROFILES[selectedAudit.supplierId as keyof typeof SUPPLIER_PROFILES] ?? null;
  const certifications =
    (CERTIFICATION_CONTEXT[selectedAudit.supplierId as keyof typeof CERTIFICATION_CONTEXT] ?? []).map(
      (cert) => ({
        ...cert,
        expiryState: deriveExpiryState(cert.status, cert.expiryDate),
      }),
    );
  const averageScore = supplierHistory.length
    ? (
        supplierHistory.reduce((sum, row) => sum + row.score, 0) / supplierHistory.length
      ).toFixed(2)
    : selectedAudit.score.toFixed(2);
  const verifiedCertifications = certifications.filter((item) => item.status === "Verified").length;
  const expiredCertifications = certifications.filter((item) => item.expiryState === "Expired").length;
  const expiringSoonCertifications = certifications.filter(
    (item) => item.expiryState === "Expiring soon",
  ).length;
  const latestAuditType = supplierHistory[0]?.type ?? selectedAudit.type;
  const previousAudit = supplierHistory.find((row) => row.auditId !== selectedAudit.auditId) ?? null;
  const scoreDelta = previousAudit ? +(selectedAudit.score - previousAudit.score).toFixed(2) : null;
  const trendLabel =
    scoreDelta === null ? "New review baseline" : scoreDelta >= 3 ? "Improving" : scoreDelta <= -3 ? "Declining" : "Stable";
  const certificationHealth =
    certifications.length === 0
      ? "No certification context"
      : expiredCertifications > 0
        ? "Expired certifications present"
        : expiringSoonCertifications > 0
          ? "Expiring certifications need review"
          : verifiedCertifications === certifications.length
        ? "Clean"
        : verifiedCertifications === 0
          ? "Needs certification review"
          : "Mixed certification status";
  const followUpUrgency =
    selectedAudit.nonCompliance >= 4 || selectedAudit.priority === "High"
      ? "High"
      : selectedAudit.nonCompliance >= 2
        ? "Medium"
        : "Low";
  const aiSummary =
    selectedAudit.nonCompliance >= 4
      ? `The selected ${selectedAudit.type.toLowerCase()} audit for ${selectedAudit.supplierName} shows elevated non-compliance and should be reviewed before normal monitoring continues.`
      : `The selected ${selectedAudit.type.toLowerCase()} audit for ${selectedAudit.supplierName} looks comparatively stable, but should still be checked against history and certification status.`;
  const aiFocusAreas = [
    selectedAudit.nonCompliance >= 4
      ? "Validate whether the non-compliance count reflects a repeated pattern in this supplier's history."
      : "Confirm this audit remains consistent with prior supplier performance.",
    certificationHealth === "Clean"
      ? "Use the certification context as supporting evidence rather than the main concern."
      : expiredCertifications > 0
        ? "Review expired certifications first because they materially affect audit readiness."
        : "Review pending or expiring certifications first because they may explain why the audit needs follow-up.",
    previousAudit
      ? `Compare the current audit against the previous ${previousAudit.type.toLowerCase()} audit from ${previousAudit.auditDate}.`
      : "Treat this as the current baseline because prior comparable audits are limited in this view.",
  ];
  const aiNextActions = [
    followUpUrgency === "High" ? "Open a closer audit review now." : "Keep the audit in active review.",
    certificationHealth === "Clean"
      ? "Proceed with history-based review."
      : "Check certification validity and expiry state before closing the audit.",
    trendLabel === "Declining"
      ? "Escalate this supplier for a stronger follow-up review."
      : "Use the current record to guide the next review step.",
  ];
  const suggestedDecision =
    followUpUrgency === "High"
      ? "Corrective action required"
      : certificationHealth === "Clean"
        ? "Monitor"
        : "Pass with conditions";

  useEffect(() => {
    if (activeTab !== "insights") {
      return;
    }

    let cancelled = false;

    async function loadInsights() {
      setInsightsLoading(true);
      setInsightsError("");

      try {
        const response = await fetch("http://localhost:8000/auditing/insights", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audit_id: selectedAudit.auditId }),
        });

        if (!response.ok) {
          throw new Error("Failed to load AI audit insights.");
        }

        const result = await response.json();
        if (!cancelled) {
          setAuditInsights(result);
        }
      } catch (error) {
        if (!cancelled) {
          setAuditInsights(null);
          setInsightsError(
            error instanceof Error ? error.message : "Unable to load AI audit insights.",
          );
        }
      } finally {
        if (!cancelled) {
          setInsightsLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedAudit.auditId]);

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

  function renderReview() {
    return (
      <div style={styles.stack}>
        <section style={styles.flowBanner}>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Selected supplier</span>
            <strong style={styles.flowBannerValue}>{selectedAudit.supplierName}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Audit score</span>
            <strong style={styles.flowBannerValue}>{selectedAudit.score.toFixed(2)}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Supplier audit history</span>
            <strong style={styles.flowBannerValue}>{supplierHistory.length} records</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Certification status</span>
            <strong style={styles.flowBannerValue}>
              {expiredCertifications > 0
                ? `${expiredCertifications} expired`
                : expiringSoonCertifications > 0
                  ? `${expiringSoonCertifications} expiring soon`
                  : `${verifiedCertifications} verified`}
            </strong>
          </div>
        </section>

        <section style={styles.reviewGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Selected audit</h2>
                <p style={styles.sectionText}>
                  Review the current audit record and the supplier context already captured in the
                  existing v2 master datasets.
                </p>
              </div>
              <span style={styles.pill}>{selectedAudit.status}</span>
            </div>

            <div style={styles.summaryGrid}>
              <ReviewItem label="Audit ID" value={`#${selectedAudit.auditId}`} />
              <ReviewItem label="Supplier ID" value={`#${selectedAudit.supplierId}`} />
              <ReviewItem label="Audit type" value={selectedAudit.type} />
              <ReviewItem label="Audit date" value={selectedAudit.auditDate} />
              <ReviewItem label="Score" value={selectedAudit.score.toFixed(2)} />
              <ReviewItem label="Non-compliance" value={String(selectedAudit.nonCompliance)} />
              <ReviewItem label="Country" value={selectedAudit.country} />
              <ReviewItem label="Priority" value={selectedAudit.priority} />
            </div>

            <div style={styles.noteCard}>
              <strong style={styles.noteTitle}>Audit outcome summary</strong>
              <p style={styles.noteText}>
                {selectedAudit.nonCompliance >= 4
                  ? "This audit needs close follow-up because the non-compliance count is elevated."
                  : "This audit looks more stable, but the selected record should still be reviewed against supplier certifications and recent history."}
              </p>
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Supplier context</h2>
                  <p style={styles.sectionText}>
                    Lightweight supplier context for the audit reviewer without stepping into the
                    separate risk module.
                  </p>
                </div>
              </div>

              <div style={styles.summaryGrid}>
                <ReviewItem label="Supplier name" value={selectedAudit.supplierName} />
                <ReviewItem label="Tier" value={profile?.tier ?? "Not available"} />
                <ReviewItem label="Size" value={profile?.size ?? "Not available"} />
                <ReviewItem label="Annual revenue" value={profile?.annualRevenue ?? "Not available"} />
                <ReviewItem label="Status" value={profile?.status ?? "Not available"} />
                <ReviewItem label="Latest audit type" value={latestAuditType} />
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Certification context</h2>
                  <p style={styles.sectionText}>
                    Certification status is shown here only as audit context, not as a full
                    certification management workflow.
                  </p>
                </div>
              </div>

              <div style={styles.certList}>
                {certifications.map((cert) => (
                  <div key={cert.name} style={styles.certListItem}>
                    <div>
                      <strong style={styles.certListName}>{cert.name}</strong>
                      <div style={styles.certListMeta}>
                        Expiry: {cert.expiryDate} · {cert.expiryState}
                      </div>
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(cert.expiryState === "Expired"
                          ? styles.statusBadgeExpired
                          : cert.expiryState === "Expiring soon"
                            ? styles.statusBadgeSoon
                            : cert.status === "Verified"
                              ? styles.statusBadgeVerified
                              : {}),
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

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Audit history</h2>
              <p style={styles.sectionText}>
                Supplier-level audit trail from existing `audits_v2.csv`, helping the user compare
                the selected audit against prior records.
              </p>
            </div>
            <span style={styles.pillAlt}>Average score {averageScore}</span>
          </div>

          <div style={styles.historyList}>
            {supplierHistory.map((row) => (
              <div key={row.auditId} style={styles.historyRow}>
                <div style={styles.historyPrimary}>
                  <strong style={styles.queueName}>
                    {row.type} audit · {row.auditDate}
                  </strong>
                  <span style={styles.queueMeta}>Audit #{row.auditId}</span>
                </div>
                <span style={styles.historyMetric}>Score {row.score.toFixed(2)}</span>
                <span style={styles.historyMetric}>{row.nonCompliance} non-compliance</span>
                <span
                  style={{
                    ...styles.statusBadge,
                    ...(row.priority === "High" ? styles.statusBadgeHigh : {}),
                  }}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderInsights() {
    const displayedSummary = auditInsights?.summary ?? aiSummary;
    const displayedConcerns =
      auditInsights?.key_concerns ?? [
        `Non-compliance count: ${selectedAudit.nonCompliance}`,
        `Certification health: ${certificationHealth}`,
        scoreDelta === null
          ? "No comparison delta available yet for this selected view."
          : `Score delta vs prior audit: ${scoreDelta > 0 ? "+" : ""}${scoreDelta}`,
      ];
    const displayedFocus = auditInsights?.reviewer_focus ?? aiFocusAreas;
    const displayedActions = auditInsights?.next_actions ?? aiNextActions;
    const displayedDecision = auditInsights?.suggested_decision ?? suggestedDecision;
    const displayedConfidence = auditInsights?.confidence ?? "derived";

    return (
      <div style={styles.stack}>
        <section style={styles.flowBanner}>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Audit health</span>
            <strong style={styles.flowBannerValue}>{followUpUrgency === "High" ? "Review now" : followUpUrgency === "Medium" ? "Monitor closely" : "Stable"}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>History trend</span>
            <strong style={styles.flowBannerValue}>{trendLabel}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Certification health</span>
            <strong style={styles.flowBannerValue}>{certificationHealth}</strong>
          </div>
          <div style={styles.flowBannerItem}>
            <span style={styles.flowBannerLabel}>Suggested decision</span>
            <strong style={styles.flowBannerValue}>{displayedDecision}</strong>
          </div>
        </section>

        <section style={styles.reviewGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>AI audit summary</h2>
                <p style={styles.sectionText}>
                  This tab turns the selected audit, certification context, and supplier history into a reviewer-friendly interpretation.
                </p>
              </div>
              <span style={styles.pillAlt}>Confidence {displayedConfidence}</span>
            </div>

            <div style={styles.noteCard}>
              <strong style={styles.noteTitle}>Summary</strong>
              <p style={styles.noteText}>{displayedSummary}</p>
            </div>

            {insightsLoading ? <p style={styles.infoText}>Generating Gemini audit insights...</p> : null}
            {insightsError ? <p style={styles.warningText}>{insightsError}</p> : null}

            <div style={styles.insightGrid}>
              <div style={styles.insightCard}>
                <strong style={styles.insightTitle}>Key concerns</strong>
                <ul style={styles.insightList}>
                  {displayedConcerns.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div style={styles.insightCard}>
                <strong style={styles.insightTitle}>Reviewer focus</strong>
                <ul style={styles.insightList}>
                  {displayedFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Suggested next actions</h2>
                  <p style={styles.sectionText}>
                    Lightweight action guidance for the internal user reviewing this audit.
                  </p>
                </div>
              </div>

              <div style={styles.actionList}>
                {displayedActions.map((action) => (
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
                    This does not replace a human decision. It gives a clean recommendation based on the selected audit context.
                  </p>
                </div>
              </div>

              <div style={styles.summaryGrid}>
                <ReviewItem label="Suggested decision" value={displayedDecision} />
                <ReviewItem label="Follow-up urgency" value={followUpUrgency} />
                <ReviewItem label="History trend" value={trendLabel} />
                <ReviewItem label="Average audit score" value={averageScore} />
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
          ? renderReview()
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
  reviewGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: "18px" },
  sideStack: { display: "grid", gap: "18px" },
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
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" },
  reviewItem: {
    display: "grid",
    gap: "4px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid rgba(17, 22, 18, 0.08)",
  },
  summaryLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  summaryValue: { color: "#152117", fontSize: "15px" },
  noteCard: {
    display: "grid",
    gap: "8px",
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, rgba(240,253,244,0.92), rgba(255,255,255,0.98))",
    border: "1px solid rgba(134, 239, 172, 0.8)",
  },
  noteTitle: { color: "#14532d", fontSize: "15px" },
  noteText: { margin: 0, color: "#45624a", lineHeight: 1.6 },
  infoText: { margin: 0, color: "#1d4ed8", fontSize: "14px" },
  warningText: { margin: 0, color: "#b91c1c", fontSize: "14px" },
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
  statusBadgeVerified: {
    background: "#ecfdf3",
    borderColor: "#bbf7d0",
    color: "#166534",
  },
  statusBadgeExpired: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
  },
  statusBadgeSoon: {
    background: "#fffbeb",
    borderColor: "#fde68a",
    color: "#b45309",
  },
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
  historyMetric: { color: "#415240", fontSize: "14px" },
  insightGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" },
  insightCard: {
    display: "grid",
    gap: "10px",
    padding: "18px",
    borderRadius: "18px",
    background: "#fff",
    border: "1px solid rgba(17, 22, 18, 0.08)",
  },
  insightTitle: { color: "#101913", fontSize: "15px" },
  insightList: { margin: 0, paddingLeft: "18px", color: "#4d5e4c", lineHeight: 1.6 },
  actionList: { display: "grid", gap: "10px" },
  actionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "14px 0",
    borderBottom: "1px solid rgba(17, 22, 18, 0.06)",
    color: "#415240",
  },
  actionDot: {
    width: "10px",
    height: "10px",
    marginTop: "5px",
    borderRadius: "999px",
    background: "#16a34a",
    flexShrink: 0,
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

function deriveExpiryState(status: string, expiryDate: string) {
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(expiry.getTime())) {
    return status === "Pending" ? "Pending" : "Unknown";
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / msPerDay);

  if (daysUntilExpiry < 0) {
    return "Expired";
  }
  if (daysUntilExpiry <= 30) {
    return "Expiring soon";
  }
  if (status === "Pending") {
    return "Pending";
  }
  return "Valid";
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.reviewItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}
