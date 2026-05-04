import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const AUDIT_TABS = [
  { id: "queue", step: "01", label: "Audit Queue" },
  { id: "review", step: "02", label: "Audit Review" },
  { id: "insights", step: "03", label: "AI Audit Insights" },
] as const;

const FILTERS = ["All", "High priority", "Open review", "External"] as const;

type AuditTabId = (typeof AUDIT_TABS)[number]["id"];
type FilterId = (typeof FILTERS)[number];

type AuditQueueRow = {
  audit_id: number;
  supplier_id: number;
  supplier_name: string;
  country?: string;
  tier?: string;
  type: string;
  audit_date: string;
  score: number;
  non_compliance: number;
  priority: string;
  status: string;
  decision?: string;
  decision_date?: string;
  capa_required?: string;
  capa_status?: string;
  capa_due_date?: string;
  expired_certifications: number;
  evidence_needs_review: number;
  eudr_relevant?: string;
  traceability_required?: string;
  evidence_status?: string;
};

type CertificationRecord = {
  cert_name: string;
  status: string;
  issue_date?: string;
  expiry_date: string;
  expiry_state: string;
  validation_status?: string;
  certificate_number?: string;
  issuing_body?: string;
  scope?: string;
};

type AuditHistoryRecord = {
  audit_id: number;
  supplier_id: number;
  audit_date: string;
  type: string;
  score: number;
  non_compliance: number;
  audit_priority?: string;
  audit_status?: string;
  audit_decision?: string;
  decision_notes?: string;
  decision_date?: string;
  capa_required?: string;
  capa_due_date?: string;
  capa_status?: string;
};

type EvidenceSummary = {
  total_count: number;
  verified_count: number;
  needs_review_count: number;
  latest_upload_date?: string | null;
  recent_records: Array<{
    evidence_id?: number | null;
    evidence_type?: string;
    linked_entity_name?: string;
    file_name?: string;
    upload_date?: string;
    validation_status?: string;
    validation_notes?: string;
  }>;
};

type CapaAction = {
  capa_id: number;
  audit_id: number;
  supplier_id: number;
  issue: string;
  severity: string;
  owner: string;
  description?: string;
  due_date: string;
  status: string;
  evidence_required: string;
  supplier_response?: string;
  evidence_notes?: string;
  created_date?: string;
  closed_date?: string;
};

type AuditWorkspacePayload = {
  queue: AuditQueueRow[];
  selected_audit: AuditHistoryRecord | null;
  supplier: Record<string, unknown>;
  audit_history: AuditHistoryRecord[];
  certifications: CertificationRecord[];
  evidence_summary: EvidenceSummary;
  capa_actions: CapaAction[];
  metrics: {
    total_audits: number;
    high_priority: number;
    open_review: number;
    evidence_review_required: number;
  };
};

type ExtractedCert = {
  cert_name: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  expiry_state: string;
  extracted_text_preview: string;
};

type AuditDecision = {
  recommendation: string;
  confidence: string;
  reasons: string[];
  required_actions: string[];
  closure_blockers: string[];
  source: string;
  provider?: string | null;
  model?: string | null;
};

const emptyEvidenceSummary: EvidenceSummary = {
  total_count: 0,
  verified_count: 0,
  needs_review_count: 0,
  latest_upload_date: null,
  recent_records: [],
};

export function AuditingWorkspace() {
  const [activeTab, setActiveTab] = useState<AuditTabId>("queue");
  const [activeFilter, setActiveFilter] = useState<FilterId>("All");
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<AuditWorkspacePayload | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const [editingCertName, setEditingCertName] = useState<string | null>(null);
  const [certUpdateForm, setCertUpdateForm] = useState({ issueDate: "", expiryDate: "", status: "Verified" });
  const [certUploadFileName, setCertUploadFileName] = useState("");
  const [certExtracted, setCertExtracted] = useState<ExtractedCert | null>(null);
  const [certExtractLoading, setCertExtractLoading] = useState(false);
  const [certExtractError, setCertExtractError] = useState("");
  const [certUpdateLoading, setCertUpdateLoading] = useState(false);
  const [certUpdateMessage, setCertUpdateMessage] = useState("");
  const [certUpdateError, setCertUpdateError] = useState("");
  const [capaForm, setCapaForm] = useState({
    issue: "",
    severity: "Major",
    owner: "Supplier",
    dueDate: "",
    evidenceRequired: "Yes",
    description: "",
  });
  const [capaMessage, setCapaMessage] = useState("");
  const [capaError, setCapaError] = useState("");
  const [capaLoading, setCapaLoading] = useState(false);
  const [auditInsights, setAuditInsights] = useState<any>(null);
  const [auditDecision, setAuditDecision] = useState<AuditDecision | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [closeMessage, setCloseMessage] = useState("");
  const [closeBlockers, setCloseBlockers] = useState<string[]>([]);
  const [closeLoading, setCloseLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [auditEvidenceType, setAuditEvidenceType] = useState("Audit Report");
  const [auditEvidenceMessage, setAuditEvidenceMessage] = useState("");
  const [auditEvidenceError, setAuditEvidenceError] = useState("");
  const [auditEvidenceLoading, setAuditEvidenceLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setWorkspaceError("");
      try {
        const suffix = selectedAuditId ? `?audit_id=${selectedAuditId}` : "";
        const response = await fetch(`http://localhost:8000/auditing/workspace${suffix}`);
        if (!response.ok) throw new Error("Failed to load audit workspace.");
        const result = await response.json();
        if (cancelled) return;
        setWorkspace(result);
        if (!selectedAuditId && result.queue?.[0]?.audit_id) {
          setSelectedAuditId(result.queue[0].audit_id);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Unable to load audit workspace.");
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [selectedAuditId, workspaceRefreshKey]);

  const queue = workspace?.queue ?? [];
  const metrics = workspace?.metrics ?? {
    total_audits: 0,
    high_priority: 0,
    open_review: 0,
    evidence_review_required: 0,
  };
  const evidenceSummary = workspace?.evidence_summary ?? emptyEvidenceSummary;
  const capaActions = workspace?.capa_actions ?? [];

  const visibleRows = useMemo(() => {
    if (activeFilter === "High priority") return queue.filter((row) => row.priority === "High");
    if (activeFilter === "Open review") return queue.filter((row) => row.status !== "Monitor");
    if (activeFilter === "External") return queue.filter((row) => row.type === "External");
    return queue;
  }, [activeFilter, queue]);

  const selectedAudit =
    visibleRows.find((row) => row.audit_id === selectedAuditId) ??
    queue.find((row) => row.audit_id === selectedAuditId) ??
    queue[0] ??
    null;
  const selectedAuditContext = workspace?.selected_audit;
  const supplier = workspace?.supplier ?? {};
  const supplierHistory = workspace?.audit_history ?? [];
  const certifications = workspace?.certifications ?? [];

  const expiredCount = certifications.filter((cert) => cert.expiry_state === "Expired").length;
  const expiringSoonCount = certifications.filter((cert) => cert.expiry_state === "Expiring soon").length;
  const verifiedCount = certifications.filter((cert) => ["Verified", "Complete"].includes(cert.status)).length;
  const averageScore = supplierHistory.length
    ? (supplierHistory.reduce((sum, row) => sum + Number(row.score || 0), 0) / supplierHistory.length).toFixed(2)
    : selectedAudit?.score.toFixed(2) ?? "0.00";
  const previousAudit = supplierHistory.find((row) => row.audit_id !== selectedAudit?.audit_id) ?? null;
  const scoreDelta =
    selectedAudit && previousAudit ? +(selectedAudit.score - Number(previousAudit.score || 0)).toFixed(2) : null;
  const trendLabel =
    scoreDelta === null ? "New review baseline" : scoreDelta >= 3 ? "Improving" : scoreDelta <= -3 ? "Declining" : "Stable";
  const followUpUrgency = selectedAudit?.priority ?? "Low";
  const certificationHealth =
    certifications.length === 0
      ? "No certification context"
      : expiredCount > 0
        ? "Expired certifications present"
        : expiringSoonCount > 0
          ? "Expiring certifications need review"
          : verifiedCount === certifications.length
            ? "Clean"
            : verifiedCount === 0
              ? "Needs certification review"
              : "Mixed certification status";

  useEffect(() => {
    if (activeTab !== "insights" || !selectedAudit) return;
    let cancelled = false;
    async function loadInsights() {
      setInsightsLoading(true);
      setInsightsError("");
      try {
        const response = await fetch("http://localhost:8000/auditing/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audit_id: selectedAudit.audit_id }),
        });
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
    void loadInsights();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedAudit?.audit_id]);

  useEffect(() => {
    if (activeTab !== "insights" || !selectedAudit) return;
    let cancelled = false;
    async function loadDecision() {
      setDecisionLoading(true);
      setDecisionError("");
      setDecisionMessage("");
      try {
        const response = await fetch("http://localhost:8000/auditing/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audit_id: selectedAudit.audit_id }),
        });
        if (!response.ok) throw new Error("Failed to load AI audit decision.");
        const result = await response.json();
        if (!cancelled) setAuditDecision(result);
      } catch (error) {
        if (!cancelled) {
          setAuditDecision(null);
          setDecisionError(error instanceof Error ? error.message : "Unable to load AI audit decision.");
        }
      } finally {
        if (!cancelled) setDecisionLoading(false);
      }
    }
    void loadDecision();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedAudit?.audit_id]);

  useEffect(() => {
    setEditingCertName(null);
    setCertUploadFileName("");
    setCertExtracted(null);
    setCertExtractError("");
    setCertUpdateMessage("");
    setCertUpdateError("");
    setAuditInsights(null);
    setAuditDecision(null);
    setDecisionMessage("");
    setDecisionError("");
    setCloseMessage("");
    setCloseBlockers([]);
  }, [selectedAuditId]);

  async function extractCertificate(file: File) {
    if (!editingCertName || !selectedAudit) return;
    setCertExtractLoading(true);
    setCertExtractError("");
    setCertUploadFileName(file.name);
    setCertExtracted(null);
    try {
      const formData = new FormData();
      formData.append("supplier_id", String(selectedAudit.supplier_id));
      formData.append("expected_cert_name", editingCertName);
      formData.append("file", file);
      const response = await fetch("http://localhost:8000/auditing/certification-extract", {
        method: "POST",
        body: formData,
      });
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
    if (!editingCertName || !selectedAudit) return;
    setCertUpdateLoading(true);
    setCertUpdateMessage("");
    setCertUpdateError("");
    try {
      const response = await fetch("http://localhost:8000/auditing/certification-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: selectedAudit.supplier_id,
          cert_name: editingCertName,
          issue_date: certUpdateForm.issueDate,
          expiry_date: certUpdateForm.expiryDate,
          status: certUpdateForm.status,
        }),
      });
      if (!response.ok) throw new Error("Failed to update supplier certification.");
      const result = await response.json();
      closeCertificateDrawer();
      setCertUpdateMessage(result.message ?? "Supplier certification updated successfully.");
      setWorkspaceRefreshKey((current) => current + 1);
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

  async function createCapaAction() {
    if (!selectedAudit || !capaForm.issue || !capaForm.dueDate) {
      setCapaError("Issue and due date are required to create a CAPA action.");
      return;
    }
    setCapaLoading(true);
    setCapaError("");
    setCapaMessage("");
    try {
      const response = await fetch("http://localhost:8000/auditing/capa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: selectedAudit.audit_id,
          issue: capaForm.issue,
          severity: capaForm.severity,
          owner: capaForm.owner,
          due_date: capaForm.dueDate,
          evidence_required: capaForm.evidenceRequired,
          description: capaForm.description,
        }),
      });
      if (!response.ok) throw new Error("Failed to create CAPA action.");
      const result = await response.json();
      setCapaMessage(result.message ?? "CAPA action created.");
      setCapaForm({ issue: "", severity: "Major", owner: "Supplier", dueDate: "", evidenceRequired: "Yes", description: "" });
      setWorkspaceRefreshKey((current) => current + 1);
    } catch (error) {
      setCapaError(error instanceof Error ? error.message : "Unable to create CAPA action.");
    } finally {
      setCapaLoading(false);
    }
  }

  async function updateCapaAction(capaId: number, status: string) {
    setCapaLoading(true);
    setCapaError("");
    setCapaMessage("");
    try {
      const response = await fetch("http://localhost:8000/auditing/capa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capa_id: capaId, status }),
      });
      if (!response.ok) throw new Error("Failed to update CAPA action.");
      const result = await response.json();
      setCapaMessage(result.message ?? "CAPA action updated.");
      setWorkspaceRefreshKey((current) => current + 1);
    } catch (error) {
      setCapaError(error instanceof Error ? error.message : "Unable to update CAPA action.");
    } finally {
      setCapaLoading(false);
    }
  }

  async function applyAuditDecision() {
    if (!selectedAudit || !auditDecision) return;
    setDecisionLoading(true);
    setDecisionError("");
    setDecisionMessage("");
    try {
      const response = await fetch("http://localhost:8000/auditing/decision/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: selectedAudit.audit_id,
          decision: auditDecision.recommendation,
          notes: auditDecision.reasons.join(" "),
        }),
      });
      if (!response.ok) throw new Error("Failed to apply audit decision.");
      const result = await response.json();
      setDecisionMessage(`${result.message}: ${result.audit_decision}`);
      setWorkspaceRefreshKey((current) => current + 1);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Unable to apply audit decision.");
    } finally {
      setDecisionLoading(false);
    }
  }

  async function uploadAuditEvidence(file: File) {
    if (!selectedAudit) return;
    setAuditEvidenceLoading(true);
    setAuditEvidenceError("");
    setAuditEvidenceMessage("");
    try {
      const payload = new FormData();
      payload.append("audit_id", String(selectedAudit.audit_id));
      payload.append("evidence_type", auditEvidenceType);
      payload.append("file", file);
      const response = await fetch("http://localhost:8000/auditing/evidence/upload", {
        method: "POST",
        body: payload,
      });
      if (!response.ok) throw new Error("Failed to upload audit evidence.");
      const result = await response.json();
      setAuditEvidenceMessage(`${result.message}: ${result.evidence.validation_status}`);
      setWorkspaceRefreshKey((current) => current + 1);
    } catch (error) {
      setAuditEvidenceError(error instanceof Error ? error.message : "Unable to upload audit evidence.");
    } finally {
      setAuditEvidenceLoading(false);
    }
  }

  async function closeAudit() {
    if (!selectedAudit) return;
    setCloseLoading(true);
    setCloseMessage("");
    setCloseBlockers([]);
    setDecisionError("");
    try {
      const response = await fetch("http://localhost:8000/auditing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: selectedAudit.audit_id }),
      });
      if (!response.ok) throw new Error("Failed to close audit.");
      const result = await response.json();
      setCloseMessage(result.message);
      setCloseBlockers(result.closure_blockers ?? []);
      setWorkspaceRefreshKey((current) => current + 1);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Unable to close audit.");
    } finally {
      setCloseLoading(false);
    }
  }

  if (workspaceLoading && !workspace) {
    return <section style={styles.panel}><p style={styles.infoText}>Loading audit workspace...</p></section>;
  }

  if (workspaceError && !workspace) {
    return <section style={styles.panel}><p style={styles.errorText}>{workspaceError}</p></section>;
  }

  if (!selectedAudit) {
    return <section style={styles.panel}><p style={styles.infoText}>No audits available.</p></section>;
  }

  return (
    <>
      <div style={styles.stack}>
        <section style={styles.tabRail}>
          {AUDIT_TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{ ...styles.tab, ...(tab.id === activeTab ? styles.tabActive : {}) }}>
              <span style={styles.tabStep}>{tab.step}</span>
              <span style={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </section>

        {activeTab === "queue" ? (
          <section style={styles.stack}>
            <section style={styles.bannerGrid}>
              <BannerItem label="Visible audits" value={String(visibleRows.length)} />
              <BannerItem label="High priority" value={String(metrics.high_priority)} />
              <BannerItem label="Open review" value={String(metrics.open_review)} />
              <BannerItem label="Evidence review" value={String(metrics.evidence_review_required)} />
            </section>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Audit queue</h2>
                  <p style={styles.sectionText}>Backend-driven audit queue from CSV, prioritized by audit score, non-compliance, certifications, evidence, and EUDR relevance.</p>
                </div>
                <span style={styles.pill}>{activeFilter}</span>
              </div>
              <div style={styles.filterRail}>
                {FILTERS.map((filter) => (
                  <button key={filter} type="button" onClick={() => setActiveFilter(filter)} style={{ ...styles.filterChip, ...(activeFilter === filter ? styles.filterChipActive : {}) }}>{filter}</button>
                ))}
              </div>
              <div style={styles.queueTable}>
                <div style={{ ...styles.queueRow, ...styles.queueHeader }}><span>Supplier</span><span>Type</span><span>Audit Date</span><span>Score</span><span>Non-compliance</span><span>Status</span></div>
                {visibleRows.map((row) => (
                  <button key={row.audit_id} type="button" onClick={() => setSelectedAuditId(row.audit_id)} style={{ ...styles.queueRow, ...(row.audit_id === selectedAudit.audit_id ? styles.queueRowActive : {}) }}>
                    <div style={styles.queuePrimary}>
                      <strong style={styles.queueName}>{row.supplier_name}</strong>
                      <span style={styles.queueMeta}>{row.country ?? "Unknown"} | #{row.supplier_id} | {row.tier ?? "Tier n/a"}</span>
                    </div>
                    <span>{row.type}</span>
                    <span>{row.audit_date}</span>
                    <span>{row.score.toFixed(2)}</span>
                    <span>{row.non_compliance}</span>
                    <span style={{ ...styles.badge, ...priorityStyle(row.priority) }}>{row.status}</span>
                  </button>
                ))}
              </div>
            </section>
          </section>
        ) : activeTab === "review" ? (
          <section style={styles.stack}>
            <section style={styles.bannerGrid}>
              <BannerItem label="Selected supplier" value={selectedAudit.supplier_name} />
              <BannerItem label="Audit score" value={selectedAudit.score.toFixed(2)} />
              <BannerItem label="Supplier audit history" value={`${supplierHistory.length} records`} />
              <BannerItem label="Evidence health" value={`${evidenceSummary.verified_count}/${evidenceSummary.total_count} accepted`} />
            </section>
            <section style={styles.reviewGrid}>
              <div style={styles.panel}>
                <div style={styles.sectionHead}>
                  <div>
                    <h2 style={styles.sectionTitle}>Selected audit</h2>
                    <p style={styles.sectionText}>The selected audit record is loaded from the backend workspace endpoint.</p>
                  </div>
                  <span style={styles.pill}>{selectedAudit.status}</span>
                </div>
                <div style={styles.summaryGrid}>
                  <ReviewItem label="Audit ID" value={`#${selectedAudit.audit_id}`} />
                  <ReviewItem label="Supplier ID" value={`#${selectedAudit.supplier_id}`} />
                  <ReviewItem label="Audit type" value={selectedAudit.type} />
                  <ReviewItem label="Audit date" value={selectedAudit.audit_date} />
                  <ReviewItem label="Score" value={selectedAudit.score.toFixed(2)} />
                  <ReviewItem label="Non-compliance" value={String(selectedAudit.non_compliance)} />
                  <ReviewItem label="Priority" value={selectedAudit.priority} />
                  <ReviewItem label="EUDR relevant" value={selectedAudit.eudr_relevant ?? "Unknown"} />
                  <ReviewItem label="Decision" value={selectedAudit.decision ?? selectedAuditContext?.audit_decision ?? "Pending"} />
                  <ReviewItem label="CAPA status" value={selectedAudit.capa_status ?? selectedAuditContext?.capa_status ?? "Not set"} />
                </div>
                <div style={styles.noteCard}>
                  <strong style={styles.noteTitle}>Audit outcome summary</strong>
                  <p style={styles.noteText}>{selectedAudit.non_compliance >= 4 ? "This audit needs close follow-up because the non-compliance count is elevated." : "This audit should be reviewed against supplier certifications, evidence, and recent history."}</p>
                </div>
              </div>
              <div style={styles.panel}>
                <div style={styles.sectionHead}>
                  <div>
                    <h2 style={styles.sectionTitle}>Supplier context</h2>
                    <p style={styles.sectionText}>Supplier master data comes from `suppliers_v2.csv` through the workspace API.</p>
                  </div>
                </div>
                <div style={styles.summaryGrid}>
                  <ReviewItem label="Supplier name" value={String(supplier.supplier_name ?? selectedAudit.supplier_name)} />
                  <ReviewItem label="Tier" value={String(supplier.tier ?? "Not available")} />
                  <ReviewItem label="Size" value={String(supplier.size ?? "Not available")} />
                  <ReviewItem label="Annual revenue" value={formatCurrency(supplier.annual_revenue)} />
                  <ReviewItem label="Status" value={String(supplier.status ?? "Not available")} />
                  <ReviewItem label="Evidence status" value={String(supplier.evidence_status ?? selectedAudit.evidence_status ?? "Unknown")} />
                </div>
              </div>
            </section>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Audit workflow state</h2>
                  <p style={styles.sectionText}>Persistent audit workflow fields from `audits_v2.csv`, ready for decisioning and CAPA in the next steps.</p>
                </div>
                <span style={styles.pillAlt}>{selectedAuditContext?.audit_status ?? selectedAudit.status}</span>
              </div>
              <div style={styles.summaryGrid}>
                <ReviewItem label="Audit status" value={selectedAuditContext?.audit_status ?? selectedAudit.status} />
                <ReviewItem label="Audit priority" value={selectedAuditContext?.audit_priority ?? selectedAudit.priority} />
                <ReviewItem label="Audit decision" value={selectedAuditContext?.audit_decision ?? selectedAudit.decision ?? "Pending"} />
                <ReviewItem label="Decision date" value={selectedAuditContext?.decision_date || selectedAudit.decision_date || "Not decided"} />
                <ReviewItem label="CAPA required" value={selectedAuditContext?.capa_required || selectedAudit.capa_required || "Not set"} />
                <ReviewItem label="CAPA due date" value={selectedAuditContext?.capa_due_date || selectedAudit.capa_due_date || "Not set"} />
                <ReviewItem label="CAPA status" value={selectedAuditContext?.capa_status || selectedAudit.capa_status || "Not set"} />
                <ReviewItem label="Decision notes" value={selectedAuditContext?.decision_notes || "No notes captured"} />
              </div>
            </section>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Corrective action plan</h2>
                  <p style={styles.sectionText}>Create and track supplier corrective actions linked to this audit. Open CAPA items roll up into the audit workflow state.</p>
                </div>
                <span style={styles.pillAlt}>{capaActions.length} actions</span>
              </div>
              <div style={styles.formGrid}>
                <Field label="Issue">
                  <input style={styles.input} value={capaForm.issue} onChange={(event) => setCapaForm((current) => ({ ...current, issue: event.target.value }))} placeholder="e.g. Missing geolocation evidence" />
                </Field>
                <Field label="Severity">
                  <select style={styles.input} value={capaForm.severity} onChange={(event) => setCapaForm((current) => ({ ...current, severity: event.target.value }))}>
                    <option>Critical</option>
                    <option>Major</option>
                    <option>Minor</option>
                  </select>
                </Field>
                <Field label="Owner">
                  <select style={styles.input} value={capaForm.owner} onChange={(event) => setCapaForm((current) => ({ ...current, owner: event.target.value }))}>
                    <option>Supplier</option>
                    <option>Responsible Sourcing</option>
                    <option>Quality</option>
                    <option>Procurement</option>
                  </select>
                </Field>
                <Field label="Due date">
                  <input type="date" style={styles.input} value={capaForm.dueDate} onChange={(event) => setCapaForm((current) => ({ ...current, dueDate: event.target.value }))} />
                </Field>
                <Field label="Evidence required">
                  <select style={styles.input} value={capaForm.evidenceRequired} onChange={(event) => setCapaForm((current) => ({ ...current, evidenceRequired: event.target.value }))}>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea style={styles.textArea} value={capaForm.description} onChange={(event) => setCapaForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the expected corrective action and evidence." />
              </Field>
              <div style={styles.actions}>
                <button type="button" onClick={() => void createCapaAction()} disabled={capaLoading} style={{ ...styles.primaryButton, ...(capaLoading ? styles.buttonDisabled : {}) }}>{capaLoading ? "Saving..." : "Create CAPA"}</button>
              </div>
              {capaMessage ? <p style={styles.successText}>{capaMessage}</p> : null}
              {capaError ? <p style={styles.errorText}>{capaError}</p> : null}
              <div style={styles.capaList}>
                {capaActions.length === 0 && !capaMessage ? <p style={styles.infoText}>No CAPA actions created for this audit yet.</p> : null}
                {capaActions.map((action) => (
                  <div key={action.capa_id} style={styles.capaCard}>
                    <div style={styles.sectionHead}>
                      <div>
                        <strong style={styles.queueName}>{action.issue}</strong>
                        <p style={styles.queueMeta}>Owner: {action.owner} | Due: {action.due_date} | Evidence required: {action.evidence_required}</p>
                      </div>
                      <span style={{ ...styles.badge, ...capaStyle(action.status, action.severity) }}>{action.status}</span>
                    </div>
                    <p style={styles.noteText}>{action.description || "No description provided."}</p>
                    <div style={styles.actions}>
                      {["Open", "In Progress", "Waiting for Evidence"].map((status) => (
                        <button key={status} type="button" onClick={() => void updateCapaAction(action.capa_id, status)} style={styles.secondaryButton}>{status}</button>
                      ))}
                      <button type="button" onClick={() => void updateCapaAction(action.capa_id, "Closed")} style={styles.primaryButton}>Close</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Certification context</h2>
                  <p style={styles.sectionText}>Expired or pending certifications can be refreshed from an uploaded certificate PDF.</p>
                </div>
                <span style={styles.pillAlt}>{certificationHealth}</span>
              </div>
              <div style={styles.certList}>
                {certifications.map((cert) => (
                  <div key={cert.cert_name} style={styles.certListItem}>
                    <div style={styles.certActionStack}>
                      <div>
                        <strong style={styles.queueName}>{cert.cert_name}</strong>
                        <div style={styles.queueMeta}>Expiry: {cert.expiry_date || "Missing"} | {cert.expiry_state}</div>
                        {cert.issuing_body ? <div style={styles.queueMeta}>Issuer: {cert.issuing_body}</div> : null}
                      </div>
                      {["Expired", "Pending", "Unknown", "Expiring soon"].includes(cert.expiry_state) ? (
                        <button type="button" onClick={() => { setEditingCertName(cert.cert_name); setCertUpdateMessage(""); }} style={styles.inlineAction}>Update certificate</button>
                      ) : null}
                    </div>
                    <span style={{ ...styles.badge, ...expiryStyle(cert.expiry_state) }}>{cert.expiry_state}</span>
                  </div>
                ))}
              </div>
              {!editingCertName && certUpdateMessage ? <p style={styles.successText}>{certUpdateMessage}</p> : null}
            </section>
            <section style={styles.reviewGrid}>
              <div style={styles.panel}>
                <div style={styles.sectionHead}>
                  <div>
                    <h2 style={styles.sectionTitle}>Evidence summary</h2>
                    <p style={styles.sectionText}>Evidence context comes from onboarding/evidence uploads and is reused during auditing.</p>
                  </div>
                  <span style={styles.pillAlt}>{evidenceSummary.needs_review_count} needs review</span>
                </div>
                <div style={styles.summaryGrid}>
                  <ReviewItem label="Evidence records" value={String(evidenceSummary.total_count)} />
                  <ReviewItem label="Accepted" value={String(evidenceSummary.verified_count)} />
                  <ReviewItem label="Needs review" value={String(evidenceSummary.needs_review_count)} />
                  <ReviewItem label="Latest upload" value={evidenceSummary.latest_upload_date ?? "None"} />
                </div>
                <div style={styles.uploadSurface}>
                  <span style={styles.uploadTitle}>Upload audit evidence</span>
                  <span style={styles.uploadText}>Audit reports, non-compliance evidence, CAPA proof, or supplier responses are stored against this audit.</span>
                  <div style={styles.formGrid}>
                    <Field label="Evidence type">
                      <select style={styles.input} value={auditEvidenceType} onChange={(event) => setAuditEvidenceType(event.target.value)}>
                        <option>Audit Report</option>
                        <option>Non-Compliance Evidence</option>
                        <option>CAPA Proof</option>
                        <option>Supplier Response</option>
                      </select>
                    </Field>
                    <Field label="Document">
                      <input type="file" accept="application/pdf" style={styles.input} disabled={auditEvidenceLoading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAuditEvidence(file); }} />
                    </Field>
                  </div>
                  {auditEvidenceLoading ? <p style={styles.infoText}>Uploading and extracting audit evidence...</p> : null}
                  {auditEvidenceMessage ? <p style={styles.successText}>{auditEvidenceMessage}</p> : null}
                  {auditEvidenceError ? <p style={styles.errorText}>{auditEvidenceError}</p> : null}
                </div>
                <div style={styles.capaList}>
                  {evidenceSummary.recent_records.slice(0, 5).map((record) => (
                    <div key={`${record.evidence_type}-${record.file_name}-${record.upload_date}`} style={styles.capaCard}>
                      <div style={styles.sectionHead}>
                        <div>
                          <strong style={styles.queueName}>{record.evidence_type || "Evidence"}</strong>
                          <p style={styles.queueMeta}>{record.file_name} | {record.upload_date || "No date"}</p>
                        </div>
                        <span style={{ ...styles.badge, ...(record.validation_status === "Accepted" || record.validation_status === "Verified" || record.validation_status === "Complete" ? styles.badgeLow : styles.badgeHigh) }}>{record.validation_status || "Uploaded"}</span>
                      </div>
                      <p style={styles.noteText}>{record.validation_notes || "No validation notes captured."}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={styles.panel}>
                <div style={styles.sectionHead}>
                  <div>
                    <h2 style={styles.sectionTitle}>Audit history</h2>
                    <p style={styles.sectionText}>Supplier-level audit trail from `audits_v2.csv`.</p>
                  </div>
                  <span style={styles.pillAlt}>Average score {averageScore}</span>
                </div>
                <div style={styles.historyList}>
                  {supplierHistory.slice(0, 6).map((row) => (
                    <div key={row.audit_id} style={styles.historyRow}>
                      <div style={styles.queuePrimary}><strong style={styles.queueName}>{row.type} audit | {row.audit_date}</strong><span style={styles.queueMeta}>Audit #{row.audit_id}</span></div>
                      <span style={styles.queueMeta}>Score {Number(row.score).toFixed(2)}</span>
                      <span style={styles.queueMeta}>{row.non_compliance} non-compliance</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </section>
        ) : (
          <section style={styles.stack}>
            <section style={styles.bannerGrid}>
              <BannerItem label="Audit health" value={followUpUrgency === "High" ? "Review now" : followUpUrgency === "Medium" ? "Monitor closely" : "Stable"} />
              <BannerItem label="History trend" value={trendLabel} />
              <BannerItem label="Certification health" value={certificationHealth} />
              <BannerItem label="Suggested decision" value={auditDecision?.recommendation ?? fallbackDecision(followUpUrgency, certificationHealth)} />
            </section>
            <section style={styles.reviewGrid}>
              <div style={styles.panel}>
                <div style={styles.sectionHead}>
                  <div>
                    <h2 style={styles.sectionTitle}>AI audit summary</h2>
                    <p style={styles.sectionText}>Gemini receives the selected backend audit context first; deterministic guidance is only the fallback.</p>
                  </div>
                  <span style={styles.pillAlt}>Confidence {auditInsights?.confidence ?? "derived"}</span>
                </div>
                <div style={styles.noteCard}>
                  <strong style={styles.noteTitle}>Summary</strong>
                  <p style={styles.noteText}>{auditInsights?.summary ?? fallbackSummary(selectedAudit)}</p>
                </div>
                {insightsLoading ? <p style={styles.infoText}>Generating Gemini audit insights...</p> : null}
                {insightsError ? <p style={styles.errorText}>{insightsError}</p> : null}
                <div style={styles.summaryGrid}>
                  <InsightCard title="Key concerns" items={auditInsights?.key_concerns ?? [`Non-compliance count: ${selectedAudit.non_compliance}`, `Certification health: ${certificationHealth}`, `Evidence needing review: ${evidenceSummary.needs_review_count}`]} />
                  <InsightCard title="Reviewer focus" items={auditInsights?.reviewer_focus ?? [selectedAudit.non_compliance >= 4 ? "Validate whether the non-compliance count reflects a repeated pattern." : "Confirm this audit remains consistent with prior performance.", expiredCount > 0 ? "Review expired certifications first." : "Use certification context to support the audit review.", previousAudit ? `Compare against the previous ${previousAudit.type.toLowerCase()} audit from ${previousAudit.audit_date}.` : "Treat this as the current baseline."]} />
                </div>
              </div>
              <div style={styles.sideStack}>
                <div style={styles.panel}>
                  <div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>Suggested next actions</h2><p style={styles.sectionText}>Action guidance for the internal audit user.</p></div></div>
                  <div style={styles.actionList}>
                    {(auditInsights?.next_actions ?? fallbackActions(followUpUrgency, certificationHealth, trendLabel)).map((action: string) => (
                      <div key={action} style={styles.actionItem}><span style={styles.actionDot} /><span>{action}</span></div>
                    ))}
                  </div>
                </div>
                <div style={styles.panel}>
                  <div style={styles.sectionHead}><div><h2 style={styles.sectionTitle}>AI audit decision</h2><p style={styles.sectionText}>Structured recommendation from the audit, CAPA, evidence, certification, and supplier context.</p></div><span style={styles.pillAlt}>{auditDecision?.source ?? "derived"}</span></div>
                  <div style={styles.summaryGrid}>
                    <ReviewItem label="Recommendation" value={auditDecision?.recommendation ?? fallbackDecision(followUpUrgency, certificationHealth)} />
                    <ReviewItem label="Decision confidence" value={auditDecision?.confidence ?? "derived"} />
                    <ReviewItem label="Follow-up urgency" value={followUpUrgency} />
                    <ReviewItem label="Closure blockers" value={String(auditDecision?.closure_blockers?.length ?? 0)} />
                  </div>
                  {decisionLoading ? <p style={styles.infoText}>Generating AI audit decision...</p> : null}
                  {decisionError ? <p style={styles.errorText}>{decisionError}</p> : null}
                  {decisionMessage ? <p style={styles.successText}>{decisionMessage}</p> : null}
                  {closeMessage ? <p style={closeBlockers.length ? styles.errorText : styles.successText}>{closeMessage}</p> : null}
                  <InsightCard title="Decision reasons" items={auditDecision?.reasons ?? [`Non-compliance count: ${selectedAudit.non_compliance}`, `Certification health: ${certificationHealth}`]} />
                  <InsightCard title="Required actions" items={auditDecision?.required_actions ?? fallbackActions(followUpUrgency, certificationHealth, trendLabel)} />
                  {(auditDecision?.closure_blockers?.length ?? 0) > 0 ? <InsightCard title="Closure blockers" items={auditDecision?.closure_blockers ?? []} /> : null}
                  {closeBlockers.length > 0 ? <InsightCard title="Close guard blockers" items={closeBlockers} /> : null}
                  <div style={styles.actions}>
                    <button type="button" onClick={() => void applyAuditDecision()} disabled={!auditDecision || decisionLoading} style={{ ...styles.primaryButton, ...((!auditDecision || decisionLoading) ? styles.buttonDisabled : {}) }}>Apply Decision</button>
                    <button type="button" onClick={() => void closeAudit()} disabled={closeLoading} style={{ ...styles.secondaryButton, ...(closeLoading ? styles.buttonDisabled : {}) }}>{closeLoading ? "Checking..." : "Close Audit"}</button>
                  </div>
                </div>
              </div>
            </section>
          </section>
        )}
      </div>

      {editingCertName ? (
        <div style={styles.drawerBackdrop} onClick={closeCertificateDrawer}>
          <aside style={styles.drawerShell} onClick={(event) => event.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Upload replacement certificate</h2>
                <p style={styles.sectionText}>Upload the replacement certificate for {editingCertName}. The system extracts fields first, then you confirm the update.</p>
              </div>
              <button type="button" onClick={closeCertificateDrawer} style={styles.drawerClose}>Close</button>
            </div>
            <label style={styles.uploadSurface}>
              <span style={styles.uploadTitle}>Select certificate PDF</span>
              <span style={styles.uploadText}>{certUploadFileName || "PDF upload only. Extraction runs as soon as you pick a file."}</span>
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
                <div style={styles.previewBox}><strong style={styles.previewTitle}>Extracted text preview</strong><p style={styles.previewText}>{certExtracted.extracted_text_preview}</p></div>
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
  textArea: { width: "100%", minHeight: "92px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17,22,18,0.12)", background: "#fff", color: "#152117", fontSize: "14px", resize: "vertical", fontFamily: "inherit" },
  actions: { display: "flex", flexWrap: "wrap", gap: "10px" },
  primaryButton: { padding: "11px 16px", borderRadius: "999px", border: "1px solid #166534", background: "#166534", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { padding: "11px 16px", borderRadius: "999px", border: "1px solid rgba(17,22,18,0.12)", background: "#fff", color: "#1c261e", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
  buttonDisabled: { opacity: 0.55, cursor: "not-allowed" },
  successText: { margin: 0, color: "#166534", fontSize: "14px" },
  errorText: { margin: 0, color: "#b91c1c", fontSize: "14px" },
  historyList: { display: "grid", gap: "10px" },
  historyRow: { display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(2, minmax(120px, 0.8fr))", gap: "14px", alignItems: "center", padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17,22,18,0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))" },
  capaList: { display: "grid", gap: "12px" },
  capaCard: { display: "grid", gap: "12px", padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17,22,18,0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))" },
  actionList: { display: "grid", gap: "10px" },
  actionItem: { display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 0", borderBottom: "1px solid rgba(17,22,18,0.06)", color: "#415240" },
  actionDot: { width: "10px", height: "10px", marginTop: "5px", borderRadius: "999px", background: "#16a34a", flexShrink: 0 },
  infoText: { margin: 0, color: "#1d4ed8", fontSize: "14px" },
  drawerBackdrop: { position: "fixed", inset: 0, background: "rgba(7, 12, 8, 0.32)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end", padding: "24px", zIndex: 60 },
  drawerShell: { width: "min(520px, 100%)", maxHeight: "100%", overflowY: "auto", display: "grid", alignContent: "start", gap: "18px", padding: "28px", borderRadius: "30px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,250,246,0.98))", border: "1px solid rgba(17,22,18,0.08)", boxShadow: "0 24px 60px rgba(17,22,18,0.18)" },
  drawerHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" },
  drawerClose: { padding: "10px 14px", borderRadius: "999px", border: "1px solid rgba(17,22,18,0.12)", background: "#fff", color: "#1c261e", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
};

function priorityStyle(priority: string) {
  return priority === "High" ? styles.badgeHigh : priority === "Medium" ? styles.badgeMedium : styles.badgeLow;
}

function expiryStyle(expiryState: string) {
  return expiryState === "Expired" ? styles.badgeHigh : expiryState === "Expiring soon" || expiryState === "Pending" ? styles.badgeMedium : styles.badgeLow;
}

function capaStyle(status: string, severity: string) {
  if (status === "Closed") return styles.badgeLow;
  if (severity === "Critical" || status === "Open") return styles.badgeHigh;
  return styles.badgeMedium;
}

function formatCurrency(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);
}

function fallbackDecision(urgency: string, certificationHealth: string) {
  if (urgency === "High") return "Corrective action required";
  if (certificationHealth === "Clean") return "Monitor";
  return "Pass with conditions";
}

function fallbackSummary(selectedAudit: AuditQueueRow) {
  return selectedAudit.non_compliance >= 4
    ? `The selected ${selectedAudit.type.toLowerCase()} audit for ${selectedAudit.supplier_name} shows elevated non-compliance and should be reviewed before normal monitoring continues.`
    : `The selected ${selectedAudit.type.toLowerCase()} audit for ${selectedAudit.supplier_name} should be checked against history, certifications, and evidence status.`;
}

function fallbackActions(urgency: string, certificationHealth: string, trendLabel: string) {
  return [
    urgency === "High" ? "Open a closer audit review now." : "Keep the audit in active review.",
    certificationHealth === "Clean" ? "Proceed with history-based review." : "Check certification validity and expiry state before closing the audit.",
    trendLabel === "Declining" ? "Escalate this supplier for stronger follow-up review." : "Use the current record to guide the next review step.",
  ];
}

function BannerItem({ label, value }: { label: string; value: string }) {
  return <div style={styles.bannerItem}><span style={styles.bannerLabel}>{label}</span><strong style={styles.bannerValue}>{value}</strong></div>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div style={styles.summaryCard}><span style={styles.summaryLabel}>{label}</span><strong style={styles.summaryValue}>{value}</strong></div>;
}

function InsightCard({ title, items }: { title: string; items: string[] }) {
  return <div style={styles.panel}><h3 style={styles.smallTitle}>{title}</h3><ul style={{ margin: 0, paddingLeft: "18px", color: "#4d5e4c", lineHeight: 1.6 }}>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div style={styles.field}><label style={styles.fieldLabel}>{label}</label>{children}</div>;
}
