
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const AUDIT_TABS = [
  { id: "queue", step: "01", label: "Audit Queue" },
  { id: "review", step: "02", label: "Audit Review" },
  { id: "insights", step: "03", label: "AI Audit Insights" },
] as const;

const FILTERS = ["All", "High priority", "Open review", "External"] as const;

const AUDIT_ROWS = [
  { auditId: 1, supplierId: 2001, supplierName: "BlueRiver Commodities Ltd", country: "Indonesia", type: "External", auditDate: "2024-06-06", score: 80.14, nonCompliance: 4, status: "Needs attention", priority: "High" },
  { auditId: 6, supplierId: 2002, supplierName: "Summit Leaf Trading Pte Ltd", country: "USA", type: "Internal", auditDate: "2024-12-04", score: 89.68, nonCompliance: 5, status: "Needs attention", priority: "High" },
  { auditId: 11, supplierId: 2003, supplierName: "TerraSource Foods Co", country: "Brazil", type: "External", auditDate: "2024-02-10", score: 99.92, nonCompliance: 5, status: "Monitor", priority: "Medium" },
  { auditId: 14, supplierId: 2004, supplierName: "Cedar Grove Exports", country: "India", type: "External", auditDate: "2024-04-18", score: 72.45, nonCompliance: 2, status: "Open review", priority: "Medium" },
  { auditId: 18, supplierId: 2005, supplierName: "Golden Acre Ingredients", country: "Vietnam", type: "Internal", auditDate: "2024-03-03", score: 66.72, nonCompliance: 5, status: "Open review", priority: "High" },
  { auditId: 23, supplierId: 2007, supplierName: "Pacific Harvest Partners", country: "Indonesia", type: "External", auditDate: "2023-11-21", score: 91.2, nonCompliance: 1, status: "Reviewed", priority: "Low" },
] as const;

const SUPPLIER_PROFILES = {
  2001: { tier: "Tier 2", size: "Medium", annualRevenue: "$33.1M", status: "Active" },
  2002: { tier: "Tier 2", size: "Medium", annualRevenue: "$73.1M", status: "Active" },
  2003: { tier: "Tier 2", size: "Medium", annualRevenue: "$52.8M", status: "Active" },
  2004: { tier: "Tier 1", size: "Medium", annualRevenue: "$73.9M", status: "Active" },
  2005: { tier: "Tier 1", size: "Small", annualRevenue: "$17.4M", status: "Active" },
  2007: { tier: "Tier 2", size: "Medium", annualRevenue: "$43.3M", status: "Active" },
} as const;

const CERTIFICATION_CONTEXT = {
  2001: [
    { name: "ISO14001", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "GMP", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "Fairtrade", status: "Verified", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
  ],
  2002: [
    { name: "PEFC", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "FSC", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "ISO22000", status: "Verified", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
  ],
  2003: [
    { name: "Rainforest Alliance", status: "Verified", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "FSC", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "ISO14001", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
  ],
  2004: [
    { name: "GMP", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "FSC", status: "Verified", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
  ],
  2005: [
    { name: "FSC", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "Fairtrade", status: "Verified", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
  ],
  2007: [
    { name: "RSPO", status: "Verified", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
    { name: "HACCP", status: "Pending", issueDate: "2024-01-01", expiryDate: "2025-01-01" },
  ],
} as const;

type AuditTabId = (typeof AUDIT_TABS)[number]["id"];
type FilterId = (typeof FILTERS)[number];
type CertRecord = { name: string; status: string; issueDate?: string; expiryDate: string };
type ExtractedCert = { cert_name: string; issue_date: string; expiry_date: string; status: string; expiry_state: string; extracted_text_preview: string };

export function AuditingWorkspace() {
  const [activeTab, setActiveTab] = useState<AuditTabId>("queue");
  const [activeFilter, setActiveFilter] = useState<FilterId>("All");
  const [selectedAuditId, setSelectedAuditId] = useState<number>(AUDIT_ROWS[0].auditId);
  const [certificationContext, setCertificationContext] = useState<Record<number, CertRecord[]>>(() => Object.fromEntries(Object.entries(CERTIFICATION_CONTEXT).map(([k, v]) => [Number(k), v.map((row) => ({ ...row }))])));
  const [editingCertName, setEditingCertName] = useState<string | null>(null);
  const [certUpdateForm, setCertUpdateForm] = useState({ issueDate: "", expiryDate: "", status: "Verified" });
  const [certUploadFileName, setCertUploadFileName] = useState("");
  const [certExtracted, setCertExtracted] = useState<ExtractedCert | null>(null);
  const [certExtractLoading, setCertExtractLoading] = useState(false);
  const [certExtractError, setCertExtractError] = useState("");
  const [certUpdateLoading, setCertUpdateLoading] = useState(false);
  const [certUpdateMessage, setCertUpdateMessage] = useState("");
  const [certUpdateError, setCertUpdateError] = useState("");
  const [auditInsights, setAuditInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const visibleRows = useMemo(() => activeFilter === "High priority" ? AUDIT_ROWS.filter((r) => r.priority === "High") : activeFilter === "Open review" ? AUDIT_ROWS.filter((r) => r.status === "Open review") : activeFilter === "External" ? AUDIT_ROWS.filter((r) => r.type === "External") : AUDIT_ROWS, [activeFilter]);
  const selectedAudit = visibleRows.find((r) => r.auditId === selectedAuditId) ?? AUDIT_ROWS.find((r) => r.auditId === selectedAuditId) ?? AUDIT_ROWS[0];
  const supplierHistory = useMemo(() => AUDIT_ROWS.filter((r) => r.supplierId === selectedAudit.supplierId).sort((a, b) => b.auditDate.localeCompare(a.auditDate)), [selectedAudit]);
  const certifications = (certificationContext[selectedAudit.supplierId] ?? []).map((cert) => ({ ...cert, expiryState: deriveExpiryState(cert.status, cert.expiryDate) }));
  const profile = SUPPLIER_PROFILES[selectedAudit.supplierId as keyof typeof SUPPLIER_PROFILES] ?? null;
  const expiredCount = certifications.filter((c) => c.expiryState === "Expired").length;
  const expiringSoonCount = certifications.filter((c) => c.expiryState === "Expiring soon").length;
  const verifiedCount = certifications.filter((c) => c.status === "Verified").length;
  const averageScore = supplierHistory.length ? (supplierHistory.reduce((sum, row) => sum + row.score, 0) / supplierHistory.length).toFixed(2) : selectedAudit.score.toFixed(2);
  const previousAudit = supplierHistory.find((row) => row.auditId !== selectedAudit.auditId) ?? null;
  const scoreDelta = previousAudit ? +(selectedAudit.score - previousAudit.score).toFixed(2) : null;
  const trendLabel = scoreDelta === null ? "New review baseline" : scoreDelta >= 3 ? "Improving" : scoreDelta <= -3 ? "Declining" : "Stable";
  const followUpUrgency = selectedAudit.nonCompliance >= 4 || selectedAudit.priority === "High" ? "High" : selectedAudit.nonCompliance >= 2 ? "Medium" : "Low";
  const certificationHealth = expiredCount > 0 ? "Expired certifications present" : expiringSoonCount > 0 ? "Expiring certifications need review" : verifiedCount === certifications.length ? "Clean" : verifiedCount === 0 ? "Needs certification review" : "Mixed certification status";

  useEffect(() => {
    if (activeTab !== "insights") return;
    let cancelled = false;
    async function loadInsights() {
      setInsightsLoading(true);
      setInsightsError("");
      try {
        const response = await fetch("http://localhost:8000/auditing/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audit_id: selectedAudit.auditId }) });
        if (!response.ok) throw new Error("Failed to load AI audit insights.");
        const result = await response.json();
        if (!cancelled) setAuditInsights(result);
      } catch (error) {
        if (!cancelled) {
          setAuditInsights(null);
          setInsightsError(error instanceof Error ? error.message : "Unable to load AI audit insights.");
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    }
    loadInsights();
    return () => { cancelled = true; };
  }, [activeTab, selectedAudit.auditId]);

  useEffect(() => {
    setEditingCertName(null);
    setCertUploadFileName("");
    setCertExtracted(null);
    setCertExtractError("");
    setCertUpdateMessage("");
    setCertUpdateError("");
  }, [selectedAudit.auditId]);

  async function extractCertificate(file: File) {
    if (!editingCertName) return;
    setCertExtractLoading(true);
    setCertExtractError("");
    setCertUploadFileName(file.name);
    setCertExtracted(null);
    try {
      const formData = new FormData();
      formData.append("supplier_id", String(selectedAudit.supplierId));
      formData.append("expected_cert_name", editingCertName);
      formData.append("file", file);
      const response = await fetch("http://localhost:8000/auditing/certification-extract", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to extract certificate details.");
      const result = await response.json();
      setCertExtracted(result);
      setCertUpdateForm({ issueDate: result.issue_date, expiryDate: result.expiry_date, status: result.status });
    } catch (error) {
      setCertExtractError(error instanceof Error ? error.message : "Unable to extract certificate details.");
    } finally {
      setCertExtractLoading(false);
    }
  }

  async function submitCertificateUpdate() {
    if (!editingCertName) return;
    setCertUpdateLoading(true);
    setCertUpdateMessage("");
    setCertUpdateError("");
    try {
      const response = await fetch("http://localhost:8000/auditing/certification-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: selectedAudit.supplierId, cert_name: editingCertName, issue_date: certUpdateForm.issueDate, expiry_date: certUpdateForm.expiryDate, status: certUpdateForm.status }),
      });
      if (!response.ok) throw new Error("Failed to update supplier certification.");
      const result = await response.json();
      setCertificationContext((current) => ({ ...current, [selectedAudit.supplierId]: (current[selectedAudit.supplierId] ?? []).map((cert) => cert.name === editingCertName ? { ...cert, issueDate: result.issue_date, expiryDate: result.expiry_date, status: result.status } : cert) }));
      closeCertificateDrawer();
      setCertUpdateMessage(result.message ?? "Supplier certification updated successfully.");
    } catch (error) {
      setCertUpdateError(error instanceof Error ? error.message : "Unable to update supplier certification.");
    } finally {
      setCertUpdateLoading(false);
    }
  }
  function closeCertificateDrawer() {
    setEditingCertName(null);
    setCertUploadFileName("");
    setCertExtracted(null);
    setCertExtractError("");
    setCertUpdateError("");
  }
  return (
    <>
    <div style={styles.stack}>
      <section style={styles.tabRail}>{AUDIT_TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{ ...styles.tab, ...(tab.id === activeTab ? styles.tabActive : {}) }}><span style={styles.tabStep}>{tab.step}</span><span style={styles.tabLabel}>{tab.label}</span></button>)}</section>
      {activeTab === "queue" ? (
        <section style={styles.stack}>
          <section style={styles.bannerGrid}><BannerItem label="Visible audits" value={String(visibleRows.length)} /><BannerItem label="High priority" value={String(AUDIT_ROWS.filter((row) => row.priority === "High").length)} /><BannerItem label="Open review" value={String(AUDIT_ROWS.filter((row) => row.status === "Open review").length)} /><BannerItem label="No upload needed" value="Existing v2 data" /></section>
          <section style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Audit queue</h2><p style={styles.sectionText}>Start auditing from existing audit records and supplier certification mappings.</p></div><span style={styles.pill}>{activeFilter}</span></div><div style={styles.filterRail}>{FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} style={{ ...styles.filterChip, ...(activeFilter === filter ? styles.filterChipActive : {}) }}>{filter}</button>)}</div><div style={styles.queueTable}><div style={{ ...styles.queueRow, ...styles.queueHeader }}><span>Supplier</span><span>Type</span><span>Audit Date</span><span>Score</span><span>Non-compliance</span><span>Status</span></div>{visibleRows.map((row) => <button key={row.auditId} type="button" onClick={() => setSelectedAuditId(row.auditId)} style={{ ...styles.queueRow, ...(row.auditId === selectedAudit.auditId ? styles.queueRowActive : {}) }}><div style={styles.queuePrimary}><strong style={styles.queueName}>{row.supplierName}</strong><span style={styles.queueMeta}>{row.country} | #{row.supplierId}</span></div><span>{row.type}</span><span>{row.auditDate}</span><span>{row.score.toFixed(2)}</span><span>{row.nonCompliance}</span><span style={{ ...styles.badge, ...(row.priority === "High" ? styles.badgeHigh : row.priority === "Medium" ? styles.badgeMedium : styles.badgeLow) }}>{row.status}</span></button>)}</div></section>
        </section>
      ) : activeTab === "review" ? (
        <section style={styles.stack}>
          <section style={styles.bannerGrid}><BannerItem label="Selected supplier" value={selectedAudit.supplierName} /><BannerItem label="Audit score" value={selectedAudit.score.toFixed(2)} /><BannerItem label="Supplier audit history" value={`${supplierHistory.length} records`} /><BannerItem label="Certification status" value={expiredCount > 0 ? `${expiredCount} expired` : expiringSoonCount > 0 ? `${expiringSoonCount} expiring soon` : `${verifiedCount} verified`} /></section>
          <section style={styles.reviewGrid}>
            <div style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Selected audit</h2><p style={styles.sectionText}>Review the current audit record and supplier context already captured in the v2 datasets.</p></div><span style={styles.pill}>{selectedAudit.status}</span></div><div style={styles.summaryGrid}><ReviewItem label="Audit ID" value={`#${selectedAudit.auditId}`} /><ReviewItem label="Supplier ID" value={`#${selectedAudit.supplierId}`} /><ReviewItem label="Audit type" value={selectedAudit.type} /><ReviewItem label="Audit date" value={selectedAudit.auditDate} /><ReviewItem label="Score" value={selectedAudit.score.toFixed(2)} /><ReviewItem label="Non-compliance" value={String(selectedAudit.nonCompliance)} /><ReviewItem label="Country" value={selectedAudit.country} /><ReviewItem label="Priority" value={selectedAudit.priority} /></div><div style={styles.noteCard}><strong style={styles.noteTitle}>Audit outcome summary</strong><p style={styles.noteText}>{selectedAudit.nonCompliance >= 4 ? "This audit needs close follow-up because the non-compliance count is elevated." : "This audit looks more stable, but the selected record should still be reviewed against supplier certifications and recent history."}</p></div></div>
            <div style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Supplier context</h2><p style={styles.sectionText}>Lightweight supplier context without stepping into the separate risk module.</p></div></div><div style={styles.summaryGrid}><ReviewItem label="Supplier name" value={selectedAudit.supplierName} /><ReviewItem label="Tier" value={profile?.tier ?? "Not available"} /><ReviewItem label="Size" value={profile?.size ?? "Not available"} /><ReviewItem label="Annual revenue" value={profile?.annualRevenue ?? "Not available"} /><ReviewItem label="Status" value={profile?.status ?? "Not available"} /><ReviewItem label="Latest audit type" value={supplierHistory[0]?.type ?? selectedAudit.type} /></div></div>
          </section>
          <section style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Certification context</h2><p style={styles.sectionText}>Expired or pending certifications can now be refreshed from an uploaded certificate PDF. Extracted fields are shown before the existing dataset is updated.</p></div></div><div style={styles.certList}>{certifications.map((cert) => <div key={cert.name} style={styles.certListItem}><div style={styles.certActionStack}><div><strong style={styles.queueName}>{cert.name}</strong><div style={styles.queueMeta}>Expiry: {cert.expiryDate} | {cert.expiryState}</div></div>{(cert.expiryState === "Expired" || cert.expiryState === "Pending") ? <button type="button" onClick={() => { setEditingCertName(cert.name); setCertUploadFileName(""); setCertExtracted(null); setCertExtractError(""); setCertUpdateMessage(""); setCertUpdateError(""); }} style={styles.inlineAction}>Update certificate</button> : null}</div><span style={{ ...styles.badge, ...(cert.expiryState === "Expired" ? styles.badgeHigh : cert.expiryState === "Expiring soon" ? styles.badgeMedium : styles.badgeLow) }}>{cert.expiryState}</span></div>)}</div>{!editingCertName && certUpdateMessage ? <p style={styles.successText}>{certUpdateMessage}</p> : null}</section>
          <section style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Audit history</h2><p style={styles.sectionText}>Supplier-level audit trail from `audits_v2.csv`, helping the user compare the selected audit against prior records.</p></div><span style={styles.pillAlt}>Average score {averageScore}</span></div><div style={styles.historyList}>{supplierHistory.map((row) => <div key={row.auditId} style={styles.historyRow}><div style={styles.queuePrimary}><strong style={styles.queueName}>{row.type} audit | {row.auditDate}</strong><span style={styles.queueMeta}>Audit #{row.auditId}</span></div><span style={styles.queueMeta}>Score {row.score.toFixed(2)}</span><span style={styles.queueMeta}>{row.nonCompliance} non-compliance</span><span style={{ ...styles.badge, ...(row.priority === "High" ? styles.badgeHigh : row.priority === "Medium" ? styles.badgeMedium : styles.badgeLow) }}>{row.status}</span></div>)}</div></section>
        </section>
      ) : (
        <section style={styles.stack}><section style={styles.bannerGrid}><BannerItem label="Audit health" value={followUpUrgency === "High" ? "Review now" : followUpUrgency === "Medium" ? "Monitor closely" : "Stable"} /><BannerItem label="History trend" value={trendLabel} /><BannerItem label="Certification health" value={certificationHealth} /><BannerItem label="Suggested decision" value={auditInsights?.suggested_decision ?? (followUpUrgency === "High" ? "Corrective action required" : certificationHealth === "Clean" ? "Monitor" : "Pass with conditions")} /></section><section style={styles.reviewGrid}><div style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>AI audit summary</h2><p style={styles.sectionText}>This tab turns the selected audit, certification context, and supplier history into a reviewer-friendly interpretation.</p></div><span style={styles.pillAlt}>Confidence {auditInsights?.confidence ?? "derived"}</span></div><div style={styles.noteCard}><strong style={styles.noteTitle}>Summary</strong><p style={styles.noteText}>{auditInsights?.summary ?? (selectedAudit.nonCompliance >= 4 ? `The selected ${selectedAudit.type.toLowerCase()} audit for ${selectedAudit.supplierName} shows elevated non-compliance and should be reviewed before normal monitoring continues.` : `The selected ${selectedAudit.type.toLowerCase()} audit for ${selectedAudit.supplierName} looks comparatively stable, but should still be checked against history and certification status.`)}</p></div>{insightsLoading ? <p style={styles.infoText}>Generating Gemini audit insights...</p> : null}{insightsError ? <p style={styles.errorText}>{insightsError}</p> : null}<div style={styles.summaryGrid}><InsightCard title="Key concerns" items={auditInsights?.key_concerns ?? [`Non-compliance count: ${selectedAudit.nonCompliance}`, `Certification health: ${certificationHealth}`, scoreDelta === null ? "No comparison delta available yet for this selected view." : `Score delta vs prior audit: ${scoreDelta > 0 ? "+" : ""}${scoreDelta}`]} /><InsightCard title="Reviewer focus" items={auditInsights?.reviewer_focus ?? [selectedAudit.nonCompliance >= 4 ? "Validate whether the non-compliance count reflects a repeated pattern in this supplier's history." : "Confirm this audit remains consistent with prior supplier performance.", expiredCount > 0 ? "Review expired certifications first because they materially affect audit readiness." : "Use certification context to support the review.", previousAudit ? `Compare the current audit against the previous ${previousAudit.type.toLowerCase()} audit from ${previousAudit.auditDate}.` : "Treat this as the current baseline."]} /></div></div><div style={styles.sideStack}><div style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Suggested next actions</h2><p style={styles.sectionText}>Lightweight action guidance for the internal user reviewing this audit.</p></div></div><div style={styles.actionList}>{(auditInsights?.next_actions ?? [followUpUrgency === "High" ? "Open a closer audit review now." : "Keep the audit in active review.", certificationHealth === "Clean" ? "Proceed with history-based review." : "Check certification validity and expiry state before closing the audit.", trendLabel === "Declining" ? "Escalate this supplier for a stronger follow-up review." : "Use the current record to guide the next review step."]).map((action: string) => <div key={action} style={styles.actionItem}><span style={styles.actionDot} /><span>{action}</span></div>)}</div></div><div style={styles.panel}><div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Decision support</h2><p style={styles.sectionText}>This does not replace a human decision. It gives a clean recommendation based on the selected audit context.</p></div></div><div style={styles.summaryGrid}><ReviewItem label="Suggested decision" value={auditInsights?.suggested_decision ?? (followUpUrgency === "High" ? "Corrective action required" : certificationHealth === "Clean" ? "Monitor" : "Pass with conditions")} /><ReviewItem label="Follow-up urgency" value={followUpUrgency} /><ReviewItem label="History trend" value={trendLabel} /><ReviewItem label="Average audit score" value={averageScore} /></div></div></div></section></section>
      )}
    </div>
    {editingCertName ? (
      <div style={styles.drawerBackdrop} onClick={closeCertificateDrawer}>
        <aside style={styles.drawerShell} onClick={(event) => event.stopPropagation()}>
          <div style={styles.drawerHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Upload replacement certificate</h2>
              <p style={styles.sectionText}>Upload the replacement certificate for {editingCertName}. The system extracts the fields first, then you confirm the update.</p>
            </div>
            <button type="button" onClick={closeCertificateDrawer} style={styles.drawerClose}>Close</button>
          </div>
          <label style={styles.uploadSurface}>
            <span style={styles.uploadTitle}>Select certificate PDF</span>
            <span style={styles.uploadText}>{certUploadFileName ? certUploadFileName : "PDF upload only. Extraction runs as soon as you pick a file."}</span>
            <input type="file" accept="application/pdf" style={styles.hiddenInput} onChange={(event) => { const file = event.target.files?.[0]; if (file) void extractCertificate(file); }} />
          </label>
          {certExtractLoading ? <p style={styles.infoText}>Extracting certificate details...</p> : null}
          {certExtractError ? <p style={styles.errorText}>{certExtractError}</p> : null}
          {certUpdateError ? <p style={styles.errorText}>{certUpdateError}</p> : null}
          {certExtracted ? (
            <>
              <div style={styles.previewBox}>
                <strong style={styles.previewTitle}>Extracted certificate details</strong>
                <div style={styles.formGrid}>
                  <Field label="Certificate"><input style={styles.input} value={certExtracted.cert_name} readOnly /></Field>
                  <Field label="Issue date"><input style={styles.input} value={certExtracted.issue_date} readOnly /></Field>
                  <Field label="Expiry date"><input style={styles.input} value={certExtracted.expiry_date} readOnly /></Field>
                  <Field label="Derived state"><input style={styles.input} value={certExtracted.expiry_state} readOnly /></Field>
                </div>
              </div>
              <div style={styles.previewBox}>
                <strong style={styles.previewTitle}>Extracted text preview</strong>
                <p style={styles.previewText}>{certExtracted.extracted_text_preview}</p>
              </div>
            </>
          ) : null}
          <div style={styles.actions}>
            <button type="button" onClick={() => void submitCertificateUpdate()} disabled={!certExtracted || certUpdateLoading} style={{ ...styles.primaryButton, ...((!certExtracted || certUpdateLoading) ? styles.buttonDisabled : {}) }}>{certUpdateLoading ? "Submitting..." : "Submit update"}</button>
            <button type="button" onClick={closeCertificateDrawer} style={styles.secondaryButton}>Cancel</button>
          </div>
        </aside>
      </div>
    ) : null}
    </>
  );
}
const styles: Record<string, CSSProperties> = {
  stack: { display: "grid", gap: "22px" },
  tabRail: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  tab: { display: "grid", gap: "6px", padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17,22,18,0.1)", background: "rgba(255,255,255,0.8)", textAlign: "left", cursor: "pointer" },
  tabActive: { background: "linear-gradient(135deg, #166534, #14532d)", borderColor: "#166534", boxShadow: "0 14px 28px rgba(22,101,52,0.2)", color: "#fff" },
  tabStep: { fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" },
  tabLabel: { fontSize: "15px", fontWeight: 600 },
  bannerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  bannerItem: { display: "grid", gap: "4px", padding: "16px 18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,250,246,0.98))", border: "1px solid rgba(17,22,18,0.08)", boxShadow: "0 8px 20px rgba(17,22,18,0.05)" },
  bannerLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#73826f" },
  bannerValue: { color: "#152117", fontSize: "1rem" },
  panel: { display: "grid", gap: "18px", width: "100%", minWidth: 0, padding: "24px", borderRadius: "28px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(17,22,18,0.08)", boxShadow: "0 10px 28px rgba(17,22,18,0.06)" },
  reviewGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: "18px", alignItems: "start" },
  sideStack: { display: "grid", gap: "18px", alignContent: "start" },
  sideBySidePanels: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "18px", alignItems: "start" },
  sectionHead: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  sectionTitle: { margin: 0, fontSize: "1.3rem", color: "#101913" },
  smallTitle: { margin: 0, fontSize: "1rem", color: "#101913" },
  sectionText: { margin: 0, maxWidth: "760px", color: "#566753", lineHeight: 1.6 },
  pill: { padding: "8px 12px", borderRadius: "999px", background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0", fontSize: "12px", fontWeight: 700 },
  pillAlt: { padding: "8px 12px", borderRadius: "999px", background: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 700 },
  filterRail: { display: "flex", flexWrap: "wrap", gap: "10px" },
  filterChip: { padding: "9px 14px", borderRadius: "999px", border: "1px solid rgba(17,22,18,0.1)", background: "#fff", color: "#2b372c", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  filterChipActive: { background: "#f0fdf4", borderColor: "#86efac", color: "#166534" },
  queueTable: { display: "grid", gap: "10px" },
  queueHeader: { background: "transparent", border: "none", boxShadow: "none", color: "#73826f", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "default" },
  queueRow: { display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(5, minmax(90px, 1fr))", gap: "14px", alignItems: "center", width: "100%", padding: "16px 18px", borderRadius: "20px", border: "1px solid rgba(17,22,18,0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))", textAlign: "left", color: "#1c261e", boxShadow: "0 6px 18px rgba(17,22,18,0.04)", cursor: "pointer" },
  queueRowActive: { borderColor: "rgba(22,101,52,0.2)", boxShadow: "0 10px 24px rgba(22,101,52,0.08)", background: "linear-gradient(180deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))" },
  queuePrimary: { display: "grid", gap: "4px" },
  queueName: { fontSize: "15px", color: "#101913" },
  queueMeta: { fontSize: "12px", color: "#6a7a67" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" },
  summaryCard: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)" },
  summaryLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  summaryValue: { color: "#152117", fontSize: "15px" },
  noteCard: { display: "grid", gap: "8px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(240,253,244,0.92), rgba(255,255,255,0.98))", border: "1px solid rgba(134,239,172,0.8)" },
  noteTitle: { color: "#14532d", fontSize: "15px" },
  noteText: { margin: 0, color: "#45624a", lineHeight: 1.6 },
  badge: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", border: "1px solid transparent" },
  badgeHigh: { background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" },
  badgeMedium: { background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" },
  badgeLow: { background: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" },
  certList: { display: "grid", gap: "10px" },
  certListItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)" },
  certActionStack: { display: "grid", gap: "8px" },
  inlineAction: { justifySelf: "flex-start", padding: "8px 12px", borderRadius: "999px", border: "1px solid rgba(22,101,52,0.18)", background: "#f0fdf4", color: "#166534", fontSize: "12px", fontWeight: 700, cursor: "pointer" },
  updateCard: { display: "grid", gap: "16px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(248,250,248,0.96), rgba(255,255,255,0.98))", border: "1px solid rgba(17,22,18,0.08)" },
  uploadSurface: { display: "grid", gap: "6px", padding: "18px", borderRadius: "18px", border: "1px dashed rgba(22,101,52,0.3)", background: "rgba(240,253,244,0.45)", cursor: "pointer" },
  uploadTitle: { color: "#14532d", fontSize: "14px", fontWeight: 700 },
  uploadText: { color: "#5d6d59", fontSize: "13px" },
  hiddenInput: { display: "none" },
  previewBox: { display: "grid", gap: "8px", padding: "16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)" },
  previewTitle: { color: "#101913", fontSize: "13px" },
  previewText: { margin: 0, color: "#4d5e4c", fontSize: "13px", lineHeight: 1.6 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  field: { display: "grid", gap: "8px" },
  fieldLabel: { fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#71816d" },
  input: { width: "100%", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17,22,18,0.12)", background: "#fff", color: "#152117", fontSize: "14px" },
  actions: { display: "flex", flexWrap: "wrap", gap: "10px" },
  primaryButton: { padding: "11px 16px", borderRadius: "999px", border: "1px solid #166534", background: "#166534", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { padding: "11px 16px", borderRadius: "999px", border: "1px solid rgba(17,22,18,0.12)", background: "#fff", color: "#1c261e", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
  buttonDisabled: { opacity: 0.55, cursor: "not-allowed" },
  successText: { margin: 0, color: "#166534", fontSize: "14px" },
  errorText: { margin: 0, color: "#b91c1c", fontSize: "14px" },
  historyList: { display: "grid", gap: "10px" },
  historyRow: { display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(3, minmax(120px, 0.8fr))", gap: "14px", alignItems: "center", padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17,22,18,0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))" },
  actionList: { display: "grid", gap: "10px" },
  actionItem: { display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 0", borderBottom: "1px solid rgba(17,22,18,0.06)", color: "#415240" },
  actionDot: { width: "10px", height: "10px", marginTop: "5px", borderRadius: "999px", background: "#16a34a", flexShrink: 0 },
  infoText: { margin: 0, color: "#1d4ed8", fontSize: "14px" },
  drawerBackdrop: { position: "fixed", inset: 0, background: "rgba(7, 12, 8, 0.32)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end", padding: "24px", zIndex: 60 },
  drawerShell: { width: "min(520px, 100%)", maxHeight: "100%", overflowY: "auto", display: "grid", alignContent: "start", gap: "18px", padding: "28px", borderRadius: "30px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,250,246,0.98))", border: "1px solid rgba(17,22,18,0.08)", boxShadow: "0 24px 60px rgba(17,22,18,0.18)" },
  drawerHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" },
  drawerClose: { padding: "10px 14px", borderRadius: "999px", border: "1px solid rgba(17,22,18,0.12)", background: "#fff", color: "#1c261e", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
};

function deriveExpiryState(status: string, expiryDate: string) {
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(expiry.getTime())) return status === "Pending" ? "Pending" : "Unknown";
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry < 0) return "Expired";
  if (daysUntilExpiry <= 30) return "Expiring soon";
  if (status === "Pending") return "Pending";
  return "Valid";
}

function BannerItem({ label, value }: { label: string; value: string }) { return <div style={styles.bannerItem}><span style={styles.bannerLabel}>{label}</span><strong style={styles.bannerValue}>{value}</strong></div>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div style={styles.summaryCard}><span style={styles.summaryLabel}>{label}</span><strong style={styles.summaryValue}>{value}</strong></div>; }
function InsightCard({ title, items }: { title: string; items: string[] }) { return <div style={styles.panel}><h3 style={styles.smallTitle}>{title}</h3><ul style={{ margin: 0, paddingLeft: "18px", color: "#4d5e4c", lineHeight: 1.6 }}>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div style={styles.field}><label style={styles.fieldLabel}>{label}</label>{children}</div>; }
