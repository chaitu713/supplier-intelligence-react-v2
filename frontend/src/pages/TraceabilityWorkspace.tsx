import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AiProvenanceBadge } from "../components/common/AiProvenanceBadge";

const TRACE_TABS = [
  { id: "overview", label: "Trace Overview" },
  { id: "trace-view", label: "Supplier / Commodity Trace" },
] as const;

const TRACE_FILTERS = ["All suppliers", "High-risk commodities", "Gaps to review"] as const;
const TRACE_EVIDENCE_TYPES = [
  "Farm / Plot Traceability",
  "Geolocation / Polygon Evidence",
  "Chain of Custody Evidence",
  "Shipment / Lot Document",
  "Deforestation-Free Declaration",
] as const;
const GAP_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const GAP_STATUSES = ["Open", "In Review", "Closed"] as const;

type ChainNode = {
  supplierId: number;
  supplierName: string;
  country: string;
  tier: string;
  isSelected: boolean;
};

type TraceCommodity = {
  name: string;
  riskLevel: string;
  deforestationRisk: number;
  volume: number;
};

type TraceCertification = {
  name: string;
  expiryState: string;
};

type TraceSite = {
  siteId: string;
  siteName: string;
  siteType: string;
  country: string;
  region: string;
  latitude?: number | null;
  longitude?: number | null;
  geoEvidenceStatus: string;
  polygonEvidenceStatus: string;
  deforestationRiskStatus: string;
  polygon?: {
    polygonId?: string;
    evidenceStatus?: string;
    geometryType?: string;
    coordinates?: number[][][];
  } | null;
};

type TraceLot = {
  lotId: string;
  commodityName: string;
  lotCode: string;
  quantity?: number | null;
  unit: string;
  productionDate: string;
  shipmentReference: string;
  currentStatus: string;
  evidenceStatus: string;
  eventCount: number;
};

type TraceEvent = {
  eventId: string;
  lotId: string;
  eventType: string;
  eventDate: string;
  country: string;
  evidenceType: string;
  evidenceStatus: string;
};

type TraceGapAction = {
  gapId: string;
  gapType: string;
  severity: string;
  status: string;
  owner: string;
  dueDate: string;
  description: string;
  recommendedAction: string;
};

type TraceEvidenceRecord = {
  evidenceId: number;
  evidenceType: string;
  linkedEntityType: string;
  linkedEntityName: string;
  fileName: string;
  uploadDate: string;
  validationStatus: string;
  validationNotes: string;
  reviewStatus: string;
  extractedTextPreview: string;
};

type TraceHistoryRecord = {
  gapId?: string;
  action?: string;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
  actionDate?: string;
  snapshotDate?: string;
  traceabilityScore?: number;
  scoreLevel?: string;
  eudrStatus?: string;
  trigger?: string;
};

type TraceabilityScore = {
  value: number;
  level: string;
};

type EudrReadiness = {
  required: boolean;
  status: string;
  missingGeoEvidence: boolean;
  missingPolygonEvidence: boolean;
  missingChainOfCustody: boolean;
  openHighSeverityGap: boolean;
};

type EvidenceCoverage = {
  status: string;
  coveragePercent: number;
  lotCount: number;
  eventCount: number;
  siteCount: number;
  missingGeoEvidenceCount: number;
  missingPolygonEvidenceCount: number;
  certificationGapCount: number;
};

type TraceRow = {
  supplierId: number;
  supplierName: string;
  country: string;
  tier?: string;
  parentSupplierId?: number | null;
  upstreamChain?: ChainNode[];
  commodities: TraceCommodity[];
  certifications: TraceCertification[];
  sites?: TraceSite[];
  lots?: TraceLot[];
  events?: TraceEvent[];
  gapActions?: TraceGapAction[];
  traceabilityScore?: TraceabilityScore;
  eudrReadiness?: EudrReadiness;
  evidenceCoverage?: EvidenceCoverage;
  evidenceRecords?: TraceEvidenceRecord[];
  gapHistory?: TraceHistoryRecord[];
  scoreHistory?: TraceHistoryRecord[];
  latestDecision?: any;
};

type TraceDecision = {
  decision?: string;
  confidence?: string;
  source?: string | null;
  provider?: string | null;
  model?: string | null;
  rationale?: string[];
  nextActions?: string[];
  decisionDate?: string;
};

const SAMPLE_SUPPLIER_TRACE_ROWS: TraceRow[] = [
  {
    supplierId: 2001,
    supplierName: "BlueRiver Commodities Ltd",
    country: "Indonesia",
    tier: "Tier 2",
    parentSupplierId: 2035,
    upstreamChain: [
      {
        supplierId: 2035,
        supplierName: "Crescent Palm Resources",
        country: "Indonesia",
        tier: "Tier 1",
        isSelected: false,
      },
      {
        supplierId: 2001,
        supplierName: "BlueRiver Commodities Ltd",
        country: "Indonesia",
        tier: "Tier 2",
        isSelected: true,
      },
    ],
    commodities: [
      { name: "Cocoa", riskLevel: "Medium", deforestationRisk: 0.61, volume: 305.11 },
      { name: "Coffee", riskLevel: "Medium", deforestationRisk: 0.4, volume: 178.73 },
      { name: "Rubber", riskLevel: "High", deforestationRisk: 0.87, volume: 304.58 },
    ],
    certifications: [
      { name: "ISO14001", expiryState: "Expired" },
      { name: "GMP", expiryState: "Expired" },
      { name: "Fairtrade", expiryState: "Expired" },
    ],
    sites: [],
    lots: [],
    events: [],
    gapActions: [],
    traceabilityScore: { value: 54, level: "Weak" },
    eudrReadiness: {
      required: true,
      status: "Needs Evidence",
      missingGeoEvidence: false,
      missingPolygonEvidence: true,
      missingChainOfCustody: true,
      openHighSeverityGap: false,
    },
    evidenceCoverage: {
      status: "Gap",
      coveragePercent: 40,
      lotCount: 0,
      eventCount: 0,
      siteCount: 0,
      missingGeoEvidenceCount: 0,
      missingPolygonEvidenceCount: 1,
      certificationGapCount: 3,
    },
  },
];

export function TraceabilityWorkspace() {
  const [activeTab, setActiveTab] = useState<(typeof TRACE_TABS)[number]["id"]>("overview");
  const [activeFilter, setActiveFilter] = useState<(typeof TRACE_FILTERS)[number]>("All suppliers");
  const [traceRows, setTraceRows] = useState<TraceRow[]>([...SAMPLE_SUPPLIER_TRACE_ROWS]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(
    SAMPLE_SUPPLIER_TRACE_ROWS[0].supplierId,
  );
  const [uploadType, setUploadType] = useState<(typeof TRACE_EVIDENCE_TYPES)[number]>(TRACE_EVIDENCE_TYPES[0]);
  const [uploadEntityId, setUploadEntityId] = useState("");
  const [uploadGapId, setUploadGapId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [gapForm, setGapForm] = useState({
    gapType: "",
    severity: "Medium",
    owner: "",
    dueDate: "",
    linkedRecordId: "",
    description: "",
    recommendedAction: "",
  });
  const [gapActionStatus, setGapActionStatus] = useState("");
  const [isSavingGap, setIsSavingGap] = useState(false);
  const [traceDecision, setTraceDecision] = useState<TraceDecision | null>(null);
  const [decisionStatus, setDecisionStatus] = useState("");

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
            result.suppliers.some((row: TraceRow) => row.supplierId === current)
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
        row.certifications.some((cert) => cert.expiryState === "Expired" || cert.expiryState === "Pending") ||
        (row.gapActions?.some((gap) => gap.status !== "Closed") ?? false) ||
        row.eudrReadiness?.status === "Blocked" ||
        row.eudrReadiness?.status === "Needs Evidence",
      );
    }
    return traceRows;
  }, [activeFilter, traceRows]);

  const selectedSupplier =
    visibleRows.find((row) => row.supplierId === selectedSupplierId) ??
    traceRows.find((row) => row.supplierId === selectedSupplierId) ??
    visibleRows[0] ??
    traceRows[0];

  const chainNodes =
    Array.isArray(selectedSupplier?.upstreamChain) && selectedSupplier.upstreamChain.length > 0
      ? selectedSupplier.upstreamChain
      : [
          {
            supplierId: selectedSupplier.supplierId,
            supplierName: selectedSupplier.supplierName,
            country: selectedSupplier.country,
            tier: selectedSupplier.tier ?? "Tier 1",
            isSelected: true,
          },
        ];

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
  const upstreamSourceCountry = chainNodes[0]?.country || selectedSupplier.country;
  const sites = selectedSupplier.sites ?? [];
  const lots = selectedSupplier.lots ?? [];
  const events = selectedSupplier.events ?? [];
  const gapActions = selectedSupplier.gapActions ?? [];
  const traceabilityScore = selectedSupplier.traceabilityScore ?? { value: 0, level: "Not scored" };
  const eudrReadiness = selectedSupplier.eudrReadiness ?? {
    required: false,
    status: "Not Required",
    missingGeoEvidence: false,
    missingPolygonEvidence: false,
    missingChainOfCustody: false,
    openHighSeverityGap: false,
  };
  const evidenceCoverage = selectedSupplier.evidenceCoverage ?? {
    status: "Gap",
    coveragePercent: 0,
    lotCount: lots.length,
    eventCount: events.length,
    siteCount: sites.length,
    missingGeoEvidenceCount: 0,
    missingPolygonEvidenceCount: 0,
    certificationGapCount: expiredCount + pendingCount,
  };
  const evidenceRecords = selectedSupplier.evidenceRecords ?? [];
  const gapHistory = selectedSupplier.gapHistory ?? [];
  const scoreHistory = selectedSupplier.scoreHistory ?? [];
  const completeComparator = [...traceRows]
    .filter((row) => row.supplierId !== selectedSupplier.supplierId && (row.gapActions ?? []).every((gap) => gap.status === "Closed"))
    .sort((first, second) => (second.traceabilityScore?.value ?? 0) - (first.traceabilityScore?.value ?? 0))[0];
  const openGapCount = gapActions.filter((gap) => gap.status !== "Closed").length;
  const acceptedEvidenceCount = evidenceRecords.filter((evidence) => evidence.reviewStatus === "Accepted").length;
  const uploadTargets = useMemo(() => {
    if (uploadType === "Farm / Plot Traceability" || uploadType === "Geolocation / Polygon Evidence") {
      return sites.map((site) => ({ id: site.siteId, label: `${site.siteName} (${site.siteId})`, entityType: "Site" }));
    }
    if (uploadType === "Shipment / Lot Document") {
      return lots.map((lot) => ({ id: lot.lotId, label: `${lot.lotCode || lot.lotId} (${lot.commodityName})`, entityType: "Lot" }));
    }
    if (uploadType === "Chain of Custody Evidence") {
      return events.map((event) => ({ id: event.eventId, label: `${event.eventType} ${event.lotId} (${event.eventId})`, entityType: "Event" }));
    }
    return sites.map((site) => ({ id: site.siteId, label: `${site.siteName} (${site.siteId})`, entityType: "Site" }));
  }, [events, lots, sites, uploadType]);

  useEffect(() => {
    setUploadEntityId(uploadTargets[0]?.id ?? "");
  }, [selectedSupplier.supplierId, uploadTargets]);

  async function handleTraceEvidenceUpload() {
    if (!uploadFile) {
      setUploadStatus("Choose a PDF before uploading.");
      return;
    }
    setIsUploading(true);
    setUploadStatus("Uploading trace evidence...");
    try {
      const target = uploadTargets.find((item) => item.id === uploadEntityId);
      const payload = new FormData();
      payload.append("file", uploadFile);
      payload.append("supplier_id", String(selectedSupplier.supplierId));
      payload.append("evidence_type", uploadType);
      payload.append("linked_entity_type", target?.entityType ?? "Traceability");
      payload.append("linked_entity_id", uploadEntityId);
      payload.append("linked_entity_name", target?.label ?? selectedSupplier.supplierName);
      if (uploadGapId) payload.append("gap_id", uploadGapId);

      const response = await fetch("http://localhost:8000/traceability/evidence/upload", {
        method: "POST",
        body: payload,
      });
      if (!response.ok) {
        throw new Error("Trace evidence upload failed.");
      }
      const refreshed = await fetch("http://localhost:8000/traceability/workspace");
      const result = await refreshed.json();
      if (Array.isArray(result?.suppliers)) {
        setTraceRows(result.suppliers);
        const refreshedSelected = result.suppliers.find((row: TraceRow) => row.supplierId === selectedSupplier.supplierId);
        setTraceDecision(refreshedSelected?.latestDecision ?? traceDecision);
      }
      setUploadFile(null);
      setUploadStatus("Evidence uploaded and trace workspace refreshed.");
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Trace evidence upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function refreshWorkspace() {
    const refreshed = await fetch("http://localhost:8000/traceability/workspace");
    const result = await refreshed.json();
    if (Array.isArray(result?.suppliers)) {
      setTraceRows(result.suppliers);
    }
  }

  async function handleCreateGapAction() {
    if (!gapForm.gapType.trim()) {
      setGapActionStatus("Add a gap type before creating the action.");
      return;
    }
    setIsSavingGap(true);
    setGapActionStatus("Creating trace gap action...");
    try {
      const linkedSite = sites.find((site) => site.siteId === gapForm.linkedRecordId);
      const linkedLot = lots.find((lot) => lot.lotId === gapForm.linkedRecordId);
      const payload = {
        supplier_id: selectedSupplier.supplierId,
        site_id: linkedSite?.siteId ?? "",
        lot_id: linkedLot?.lotId ?? "",
        gap_type: gapForm.gapType,
        severity: gapForm.severity,
        status: "Open",
        owner: gapForm.owner,
        due_date: gapForm.dueDate,
        description: gapForm.description,
        recommended_action: gapForm.recommendedAction,
      };
      const response = await fetch("http://localhost:8000/traceability/gap-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Trace gap action creation failed.");
      await refreshWorkspace();
      setGapForm({ gapType: "", severity: "Medium", owner: "", dueDate: "", linkedRecordId: "", description: "", recommendedAction: "" });
      setGapActionStatus("Trace gap action created.");
    } catch (error) {
      setGapActionStatus(error instanceof Error ? error.message : "Trace gap action creation failed.");
    } finally {
      setIsSavingGap(false);
    }
  }

  async function handleUpdateGapAction(gapId: string, payload: Record<string, string>) {
    setGapActionStatus("Updating trace gap action...");
    try {
      const response = await fetch(`http://localhost:8000/traceability/gap-actions/${encodeURIComponent(gapId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Trace gap action update failed.");
      await refreshWorkspace();
      setGapActionStatus("Trace gap action updated.");
    } catch (error) {
      setGapActionStatus(error instanceof Error ? error.message : "Trace gap action update failed.");
    }
  }

  async function handleTraceDecision() {
    setDecisionStatus("Generating trace decision...");
    try {
      const response = await fetch("http://localhost:8000/traceability/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: selectedSupplier.supplierId }),
      });
      if (!response.ok) throw new Error("Trace decision failed.");
      const decision = await response.json();
      setTraceDecision(decision);
      await refreshWorkspace();
      setDecisionStatus("Trace decision ready.");
    } catch (error) {
      setDecisionStatus(error instanceof Error ? error.message : "Trace decision failed.");
    }
  }

  async function handleEvidenceReview(evidenceId: number, reviewStatus: string) {
    await fetch("http://localhost:8000/traceability/evidence/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_id: evidenceId, review_status: reviewStatus }),
    });
    await refreshWorkspace();
  }

  function renderOverview() {
    return (
      <div style={styles.stack}>
        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Trace overview</h2>
              <p style={styles.sectionText}>
                This view ties supplier, tier, commodity, country, and certification mappings into one practical traceability surface.
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
                {selectedSupplier.country} | {selectedSupplier.tier ?? "Tier 1"} | {selectedSupplier.commodities.length} commodities
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
              <span>{selectedSupplier.tier ?? "Tier 1"}</span>
              <span>{chainNodes.length} chain levels</span>
              <span>{traceabilityScore.value} trace score</span>
              <span>{eudrReadiness.status} EUDR</span>
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
                Commodity coverage comes from supplier-to-commodity mappings and keeps the risk coloring consistent with the commodity master.
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
                <span style={{ ...styles.statusBadge, ...getRiskBadgeStyle(commodity.riskLevel) }}>
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
          <MetricCard label="Selected supplier" value={selectedSupplier.supplierName} />
          <MetricCard label="Traceability score" value={`${traceabilityScore.value} / ${traceabilityScore.level}`} />
          <MetricCard label="EUDR readiness" value={eudrReadiness.status} />
          <MetricCard label="Evidence coverage" value={`${evidenceCoverage.coveragePercent}%`} />
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Trace decision support</h2>
              <p style={styles.sectionText}>Generate a reviewer-ready recommendation from mapped sites, lot lineage, uploaded evidence, open actions, and EUDR readiness.</p>
            </div>
            <div style={styles.provenanceRail}>
              {(traceDecision || selectedSupplier.latestDecision) ? (
                <AiProvenanceBadge provenance={traceDecision || selectedSupplier.latestDecision} />
              ) : null}
              <button type="button" onClick={handleTraceDecision} style={styles.primaryButton}>Generate decision</button>
            </div>
          </div>
          {decisionStatus ? <span style={styles.uploadStatus}>{decisionStatus}</span> : null}
          {traceDecision ? (
            <div style={styles.decisionBox}>
              <ReviewItem label="Decision" value={traceDecision.decision || "Review required"} />
              <ReviewItem label="Confidence" value={traceDecision.confidence || "medium"} />
              <ReviewItem label="Source" value={traceDecision.source || "deterministic_fallback"} />
              <ReviewItem label="Provider" value={traceDecision.provider || "Rules"} />
              <div style={styles.insightCard}>
                <strong style={styles.insightTitle}>Rationale</strong>
                <ul style={styles.insightList}>{(traceDecision.rationale || []).map((item: string) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div style={styles.insightCard}>
                <strong style={styles.insightTitle}>Next actions</strong>
                <ul style={styles.insightList}>{(traceDecision.nextActions || []).map((item: string) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          ) : null}
          {!traceDecision && selectedSupplier.latestDecision ? (
            <div style={styles.decisionBox}>
              <ReviewItem label="Latest saved decision" value={selectedSupplier.latestDecision.decision} />
              <ReviewItem label="Confidence" value={selectedSupplier.latestDecision.confidence} />
              <ReviewItem label="Source" value={selectedSupplier.latestDecision.source || "deterministic_fallback"} />
              <ReviewItem label="Saved" value={selectedSupplier.latestDecision.decisionDate} />
            </div>
          ) : null}
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Trace decision journey</h2>
              <p style={styles.sectionText}>Use this as the client walkthrough: origin mapped, evidence reviewed, actions resolved, decision refreshed.</p>
            </div>
            <span style={{ ...styles.statusBadge, ...getEvidenceBadgeStyle(eudrReadiness.status) }}>{eudrReadiness.status}</span>
          </div>

          <div style={styles.journeyRail}>
            <JourneyStep index={1} title="Origin sites" detail={`${sites.length} mapped sites, ${sites.filter((site) => site.polygon?.coordinates?.length).length} polygon footprints`} state={sites.length ? "complete" : "gap"} />
            <JourneyStep index={2} title="Evidence review" detail={`${evidenceRecords.length} documents uploaded, ${acceptedEvidenceCount} accepted`} state={acceptedEvidenceCount ? "complete" : evidenceRecords.length ? "review" : "gap"} />
            <JourneyStep index={3} title="Open actions" detail={`${openGapCount} actions still need follow-up`} state={openGapCount ? "gap" : "complete"} />
            <JourneyStep index={4} title="Trace score" detail={`${traceabilityScore.value} / ${traceabilityScore.level}`} state={traceabilityScore.value >= 80 ? "complete" : traceabilityScore.value >= 60 ? "review" : "gap"} />
            <JourneyStep index={5} title="Current decision" detail={(traceDecision || selectedSupplier.latestDecision)?.decision || "Generate decision"} state={eudrReadiness.status === "Ready" ? "complete" : eudrReadiness.status === "Needs Evidence" ? "review" : "gap"} />
          </div>

          {selectedSupplier.supplierId === 2001 ? (
            <div style={styles.demoCallout}>
              <strong>Presenter path for BlueRiver</strong>
              <span>Start with the missing polygon blocker, upload the Geolocation / Polygon Evidence PDF, accept it, close the gap, then regenerate the decision.</span>
            </div>
          ) : null}

          {completeComparator ? (
            <div style={styles.comparatorCard}>
              <div>
                <span style={styles.selectorInfoLabel}>Complete trace comparator</span>
                <strong style={styles.selectorInfoValue}>{completeComparator.supplierName}</strong>
                <span style={styles.selectorInfoMeta}>{completeComparator.country} | score {completeComparator.traceabilityScore?.value} | {completeComparator.eudrReadiness?.status}</span>
              </div>
              <button type="button" onClick={() => setSelectedSupplierId(completeComparator.supplierId)} style={styles.secondaryButton}>View comparator</button>
            </div>
          ) : null}
        </section>

        <section style={styles.reviewGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Supplier trace view</h2>
                <p style={styles.sectionText}>
                  The chain now follows supplier tier links first, then extends into source country, mapped commodities, and certification support.
                </p>
              </div>
              <span style={styles.pillAlt}>Supplier #{selectedSupplier.supplierId}</span>
            </div>

            <div style={styles.summaryGrid}>
              <ReviewItem label="Supplier" value={selectedSupplier.supplierName} />
              <ReviewItem label="Tier" value={selectedSupplier.tier ?? "Tier 1"} />
              <ReviewItem label="Country" value={selectedSupplier.country} />
              <ReviewItem label="Sites" value={String(sites.length)} />
              <ReviewItem label="Lots" value={String(lots.length)} />
              <ReviewItem label="Events" value={String(events.length)} />
              <ReviewItem label="Open trace gaps" value={String(gapActions.filter((gap) => gap.status !== "Closed").length)} />
            </div>

            <div style={styles.noteCard}>
              <strong style={styles.noteTitle}>Trace summary</strong>
              <p style={styles.noteText}>
                {selectedSupplier.supplierName} currently sits at {selectedSupplier.tier ?? "Tier 1"} and resolves through {Math.max(chainNodes.length - 1, 0)} upstream supplier links before reaching the mapped country, commodity, and certification picture.
              </p>
            </div>

            <div style={styles.uploadPanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Upload trace evidence</h2>
                  <p style={styles.sectionText}>
                    Attach the supplier PDF to the correct site, lot, event, or open action.
                  </p>
                </div>
              </div>

              <div style={styles.uploadGrid}>
                <div style={styles.field}>
                  <label htmlFor="trace-upload-type" style={styles.label}>Evidence type</label>
                  <select id="trace-upload-type" value={uploadType} onChange={(event) => setUploadType(event.target.value as (typeof TRACE_EVIDENCE_TYPES)[number])} style={styles.selectInput}>
                    {TRACE_EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div style={styles.field}>
                  <label htmlFor="trace-upload-target" style={styles.label}>Linked trace record</label>
                  <select id="trace-upload-target" value={uploadEntityId} onChange={(event) => setUploadEntityId(event.target.value)} style={styles.selectInput}>
                    {uploadTargets.length ? uploadTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>) : <option value="">No target records available</option>}
                  </select>
                </div>

                <div style={styles.field}>
                  <label htmlFor="trace-upload-gap" style={styles.label}>Related gap action</label>
                  <select id="trace-upload-gap" value={uploadGapId} onChange={(event) => setUploadGapId(event.target.value)} style={styles.selectInput}>
                    <option value="">No gap link</option>
                    {gapActions.map((gap) => <option key={gap.gapId} value={gap.gapId}>{gap.gapType} ({gap.gapId})</option>)}
                  </select>
                </div>

                <div style={styles.field}>
                  <label htmlFor="trace-upload-file" style={styles.label}>PDF evidence</label>
                  <input id="trace-upload-file" type="file" accept="application/pdf" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} style={styles.fileInput} />
                </div>
              </div>

              <div style={styles.uploadActions}>
                <button type="button" onClick={handleTraceEvidenceUpload} disabled={isUploading || !uploadFile || !uploadEntityId} style={{ ...styles.primaryButton, ...((isUploading || !uploadFile || !uploadEntityId) ? styles.primaryButtonDisabled : {}) }}>
                  {isUploading ? "Uploading..." : "Upload evidence"}
                </button>
                {uploadStatus ? <span style={styles.uploadStatus}>{uploadStatus}</span> : null}
              </div>
            </div>

            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Traceability chain</h2>
                <p style={styles.sectionText}>
                  A cleaner production-style vertical chain that makes the tier hierarchy and downstream trace context easy to scan.
                </p>
              </div>
            </div>

            <div style={styles.chainBoard}>
              <div style={styles.chainTrack} />
              {chainNodes.map((node, index) => (
                <ChainStage
                  key={`${node.supplierId}-${index}`}
                  index={index + 1}
                  eyebrow={node.tier}
                  tag={node.isSelected ? "Current supplier" : "Upstream supplier"}
                  title={node.supplierName}
                  meta={`${node.country} | Supplier #${node.supplierId}`}
                  selected={node.isSelected}
                />
              ))}

              <ChainStage
                index={chainNodes.length + 1}
                eyebrow="Upstream source country"
                tag="Operational anchor"
                title={upstreamSourceCountry}
                meta="Country anchored to the topmost upstream supplier"
              />

              <ChainStage
                index={chainNodes.length + 2}
                eyebrow="Mapped commodities"
                tag={`${selectedSupplier.commodities.length} linked`}
                title="Commodity footprint"
                chips={selectedSupplier.commodities.map((commodity) => ({ label: commodity.name }))}
              />

              <ChainStage
                index={chainNodes.length + 3}
                eyebrow="Certification support"
                tag={`${selectedSupplier.certifications.length} linked`}
                title="Current evidence support"
                chips={selectedSupplier.certifications.map((cert) => ({
                  label: cert.name,
                  tone:
                    cert.expiryState === "Expired"
                      ? "high"
                      : cert.expiryState === "Pending" || cert.expiryState === "Expiring soon"
                        ? "medium"
                        : "low",
                }))}
              />
            </div>

            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Lot movement timeline</h2>
                <p style={styles.sectionText}>
                  Batch and shipment records now sit inside the same supplier trace.
                </p>
              </div>
            </div>

            <div style={styles.historyList}>
              {lots.length ? lots.map((lot) => (
                <div key={lot.lotId} style={styles.historyRow}>
                  <div style={styles.historyPrimary}>
                    <strong style={styles.queueName}>{lot.lotCode || lot.lotId}</strong>
                    <span style={styles.queueMeta}>{lot.commodityName} | {lot.productionDate || "No production date"}</span>
                  </div>
                  <span style={styles.historyMetric}>{lot.quantity ?? "-"} {lot.unit}</span>
                  <span style={styles.historyMetric}>{lot.eventCount} events</span>
                  <span style={{ ...styles.statusBadge, ...getEvidenceBadgeStyle(lot.evidenceStatus) }}>{lot.evidenceStatus}</span>
                </div>
              )) : (
                <div style={styles.emptyState}>No lot records are linked to this supplier yet.</div>
              )}
            </div>
          </div>

          <div style={styles.sideStack}>
            <div style={styles.sidePanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Site and polygon view</h2>
                  <p style={styles.sectionText}>
                    Show origin coordinates and GeoJSON polygon footprints with evidence status.
                  </p>
                </div>
              </div>

              <div style={styles.mapPanel}>
                <GeoJsonPolygonMap sites={sites} />
                <div style={styles.mapLegend}>
                  <span><i style={{ ...styles.legendDot, background: "#16a34a" }} /> Complete</span>
                  <span><i style={{ ...styles.legendDot, background: "#f59e0b" }} /> Needs review</span>
                  <span><i style={{ ...styles.legendDot, background: "#dc2626" }} /> High risk</span>
                </div>
              </div>

              <div style={styles.detailList}>
                {sites.length ? sites.map((site) => (
                  <div key={site.siteId} style={styles.siteListItem}>
                    <div>
                      <strong style={styles.certListName}>{site.siteName}</strong>
                      <div style={styles.certListMeta}>{site.siteType} | {site.region || site.country}</div>
                      {site.polygon?.polygonId ? <div style={styles.certListMeta}>Polygon {site.polygon.polygonId}</div> : null}
                      <div style={styles.gapDescription}>Geo: {site.geoEvidenceStatus} | Polygon: {site.polygonEvidenceStatus} | Deforestation: {site.deforestationRiskStatus}</div>
                    </div>
                    <span style={{ ...styles.statusBadge, ...getEvidenceBadgeStyle(site.polygonEvidenceStatus) }}>
                      {site.polygonEvidenceStatus}
                    </span>
                  </div>
                )) : (
                  <div style={styles.emptyState}>No site records linked.</div>
                )}
              </div>
            </div>

            <div style={styles.sidePanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Commodity footprint</h2>
                  <p style={styles.sectionText}>
                    Commodity-level trace with risk context from the current commodity master.
                  </p>
                </div>
              </div>

              <div style={styles.detailList}>
                {selectedSupplier.commodities.map((commodity) => (
                  <div key={commodity.name} style={styles.commodityListItem}>
                    <div>
                      <strong style={styles.certListName}>{commodity.name}</strong>
                      <div style={styles.certListMeta}>
                        Volume {commodity.volume.toFixed(2)} | Deforestation {commodity.deforestationRisk.toFixed(2)}
                      </div>
                    </div>
                    <span style={{ ...styles.statusBadge, ...getRiskBadgeStyle(commodity.riskLevel) }}>
                      {commodity.riskLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.sidePanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Certification-backed trace</h2>
                  <p style={styles.sectionText}>
                    Certification posture strengthens or weakens the current trace picture.
                  </p>
                </div>
              </div>

              <div style={styles.detailList}>
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
                          : cert.expiryState === "Pending" || cert.expiryState === "Expiring soon"
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

            <div style={styles.sidePanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Open trace actions</h2>
                  <p style={styles.sectionText}>
                    Track evidence requests and close them once reviewed.
                  </p>
                </div>
              </div>

              <div style={styles.gapForm}>
                <div style={styles.uploadGrid}>
                  <div style={styles.field}>
                    <label htmlFor="gap-type" style={styles.label}>Gap type</label>
                    <input id="gap-type" value={gapForm.gapType} onChange={(event) => setGapForm((current) => ({ ...current, gapType: event.target.value }))} style={styles.textInput} placeholder="Missing polygon" />
                  </div>
                  <div style={styles.field}>
                    <label htmlFor="gap-severity" style={styles.label}>Severity</label>
                    <select id="gap-severity" value={gapForm.severity} onChange={(event) => setGapForm((current) => ({ ...current, severity: event.target.value }))} style={styles.selectInput}>
                      {GAP_SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label htmlFor="gap-owner" style={styles.label}>Owner</label>
                    <input id="gap-owner" value={gapForm.owner} onChange={(event) => setGapForm((current) => ({ ...current, owner: event.target.value }))} style={styles.textInput} placeholder="Traceability Manager" />
                  </div>
                  <div style={styles.field}>
                    <label htmlFor="gap-due" style={styles.label}>Due date</label>
                    <input id="gap-due" type="date" value={gapForm.dueDate} onChange={(event) => setGapForm((current) => ({ ...current, dueDate: event.target.value }))} style={styles.textInput} />
                  </div>
                  <div style={styles.field}>
                    <label htmlFor="gap-link" style={styles.label}>Linked record</label>
                    <select id="gap-link" value={gapForm.linkedRecordId} onChange={(event) => setGapForm((current) => ({ ...current, linkedRecordId: event.target.value }))} style={styles.selectInput}>
                      <option value="">No record link</option>
                      {sites.map((site) => <option key={site.siteId} value={site.siteId}>Site: {site.siteName}</option>)}
                      {lots.map((lot) => <option key={lot.lotId} value={lot.lotId}>Lot: {lot.lotCode || lot.lotId}</option>)}
                    </select>
                  </div>
                </div>
                <div style={styles.field}>
                  <label htmlFor="gap-description" style={styles.label}>Description</label>
                  <textarea id="gap-description" value={gapForm.description} onChange={(event) => setGapForm((current) => ({ ...current, description: event.target.value }))} style={styles.textArea} placeholder="Describe the traceability gap." />
                </div>
                <div style={styles.field}>
                  <label htmlFor="gap-action" style={styles.label}>Recommended action</label>
                  <textarea id="gap-action" value={gapForm.recommendedAction} onChange={(event) => setGapForm((current) => ({ ...current, recommendedAction: event.target.value }))} style={styles.textArea} placeholder="Describe the requested evidence or remediation." />
                </div>
                <div style={styles.uploadActions}>
                  <button type="button" onClick={handleCreateGapAction} disabled={isSavingGap} style={{ ...styles.primaryButton, ...(isSavingGap ? styles.primaryButtonDisabled : {}) }}>
                    {isSavingGap ? "Creating..." : "Create gap action"}
                  </button>
                  {gapActionStatus ? <span style={styles.uploadStatus}>{gapActionStatus}</span> : null}
                </div>
              </div>

              <div style={styles.detailList}>
                {gapActions.length ? gapActions.map((gap) => (
                  <div key={gap.gapId} style={styles.gapListItem}>
                    <div>
                      <strong style={styles.certListName}>{gap.gapType}</strong>
                      <div style={styles.certListMeta}>{gap.owner || "Unassigned"} | due {gap.dueDate || "TBD"} | {gap.status}</div>
                      {gap.description ? <div style={styles.gapDescription}>{gap.description}</div> : null}
                    </div>
                    <div style={styles.gapControls}>
                      <span style={{ ...styles.statusBadge, ...getGapBadgeStyle(gap.severity) }}>{gap.severity}</span>
                      <select value={gap.status} onChange={(event) => handleUpdateGapAction(gap.gapId, { status: event.target.value })} style={styles.compactSelect}>
                        {GAP_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      {gap.status !== "Closed" ? (
                        <button type="button" onClick={() => handleUpdateGapAction(gap.gapId, { status: "Closed", closure_notes: "Closed from Traceability workspace" })} style={styles.secondaryButton}>Close</button>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <div style={styles.emptyState}>No trace gap actions are open.</div>
                )}
              </div>
            </div>

            <div style={styles.sidePanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Evidence review queue</h2>
                  <p style={styles.sectionText}>Review uploaded supplier documents and mark accepted or clarification needed.</p>
                </div>
              </div>
              <div style={styles.detailList}>
                {evidenceRecords.length ? evidenceRecords.map((evidence) => (
                  <div key={evidence.evidenceId} style={styles.evidenceItem}>
                    <div>
                      <strong style={styles.certListName}>{evidence.fileName}</strong>
                      <div style={styles.certListMeta}>{evidence.evidenceType} | {evidence.linkedEntityName || evidence.linkedEntityType}</div>
                      <div style={styles.gapDescription}>{evidence.extractedTextPreview?.slice(0, 180)}</div>
                    </div>
                    <div style={styles.gapControls}>
                      <span style={{ ...styles.statusBadge, ...getEvidenceBadgeStyle(evidence.validationStatus) }}>{evidence.reviewStatus || evidence.validationStatus}</span>
                      <button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "Accepted")} style={styles.secondaryButton}>Accept</button>
                      <button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "Needs Supplier Clarification")} style={styles.secondaryButton}>Clarify</button>
                    </div>
                  </div>
                )) : <div style={styles.emptyState}>No uploaded trace evidence for this supplier yet.</div>}
              </div>
            </div>

            <div style={styles.sidePanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Trace history</h2>
                  <p style={styles.sectionText}>Gap action history and recent score snapshots.</p>
                </div>
              </div>
              <div style={styles.detailList}>
                {[...gapHistory.slice(-4), ...scoreHistory.slice(-4)].length ? [...gapHistory.slice(-4), ...scoreHistory.slice(-4)].map((item, index) => (
                  <div key={`${item.gapId || item.snapshotDate}-${index}`} style={styles.historyMiniItem}>
                    <strong style={styles.certListName}>{item.action || item.trigger || "Score snapshot"}</strong>
                    <span style={styles.certListMeta}>{item.actionDate || item.snapshotDate} {item.traceabilityScore != null ? `| score ${item.traceabilityScore}` : ""}</span>
                    {item.notes ? <span style={styles.gapDescription}>{item.notes}</span> : null}
                  </div>
                )) : <div style={styles.emptyState}>No trace history has been recorded yet.</div>}
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
                <span style={styles.tabLabel}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "overview" ? renderOverview() : renderTraceView()}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: "grid", gap: "22px" },
  embeddedFrame: { display: "grid", gap: "16px", padding: "0" },
  tabRail: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "center", gap: "8px", width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #dfe7dd", background: "#ffffff", boxShadow: "0 1px 2px rgba(17,22,18,0.04)" },
  tab: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: "42px", padding: "9px 16px", borderRadius: "6px", border: "1px solid transparent", background: "transparent", color: "#40503d", textAlign: "center", cursor: "pointer" },
  tabActive: { background: "#166534", borderColor: "#166534", boxShadow: "none", color: "#ffffff" },
  tabLabel: { fontSize: "13px", fontWeight: 800, whiteSpace: "nowrap" },
  flowBanner: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  flowBannerItem: { display: "grid", gap: "4px", padding: "16px 18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,250,246,0.98))", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 8px 20px rgba(17, 22, 18, 0.05)" },
  flowBannerLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#73826f" },
  flowBannerValue: { color: "#152117", fontSize: "1rem" },
  panel: { display: "grid", gap: "18px", width: "100%", minWidth: 0, padding: "24px", borderRadius: "28px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)" },
  sectionHead: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  provenanceRail: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: "10px" },
  sectionTitle: { margin: 0, fontSize: "1.3rem", color: "#101913" },
  sectionText: { marginTop: "6px", maxWidth: "760px", color: "#566753" },
  pill: { padding: "8px 12px", borderRadius: "999px", background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0", fontSize: "12px", fontWeight: 700 },
  pillAlt: { padding: "8px 12px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: "12px", fontWeight: 700 },
  filterRail: { display: "flex", flexWrap: "wrap", gap: "10px" },
  selectorGrid: { display: "grid", gridTemplateColumns: "minmax(280px, 1.2fr) minmax(240px, 0.8fr)", gap: "14px" },
  field: { display: "grid", gap: "8px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#1d2a1f" },
  selectInput: { width: "100%", minHeight: "46px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "14px" },
  selectorInfoCard: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "linear-gradient(180deg, rgba(246,250,246,0.96), rgba(255,255,255,0.98))", border: "1px solid rgba(17, 22, 18, 0.08)" },
  selectorInfoLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  selectorInfoValue: { color: "#152117", fontSize: "15px" },
  selectorInfoMeta: { color: "#61705d", fontSize: "13px" },
  uploadPanel: { display: "grid", gap: "16px", padding: "18px", borderRadius: "20px", background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.1)" },
  uploadGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  fileInput: { width: "100%", minHeight: "46px", padding: "10px 12px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "13px" },
  uploadActions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" },
  primaryButton: { minHeight: "42px", padding: "10px 16px", borderRadius: "8px", border: "1px solid #166534", background: "#166534", color: "#ffffff", fontSize: "13px", fontWeight: 800, cursor: "pointer" },
  primaryButtonDisabled: { opacity: 0.55, cursor: "not-allowed" },
  uploadStatus: { color: "#415240", fontSize: "13px" },
  textInput: { width: "100%", minHeight: "46px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "14px" },
  textArea: { width: "100%", minHeight: "76px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "14px", resize: "vertical" },
  gapForm: { display: "grid", gap: "12px", padding: "14px", borderRadius: "18px", background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.08)" },
  gapControls: { display: "grid", justifyItems: "end", gap: "8px", minWidth: "120px" },
  compactSelect: { width: "120px", minHeight: "34px", padding: "6px 8px", borderRadius: "8px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "12px" },
  secondaryButton: { minHeight: "34px", padding: "7px 10px", borderRadius: "8px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#ffffff", color: "#334155", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  gapDescription: { marginTop: "8px", color: "#64748b", fontSize: "12px", lineHeight: 1.45 },
  filterChip: { padding: "9px 14px", borderRadius: "999px", border: "1px solid rgba(17, 22, 18, 0.1)", background: "#fff", color: "#2b372c", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  filterChipActive: { background: "#f0fdf4", borderColor: "#86efac", color: "#166534" },
  traceSummaryCard: { display: "grid", gap: "12px", padding: "18px", borderRadius: "22px", border: "1px solid rgba(17, 22, 18, 0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))" },
  traceCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  traceCardTitle: { color: "#101913", fontSize: "15px" },
  traceCardCountry: { color: "#5f705f", fontSize: "13px" },
  traceCardMeta: { display: "flex", flexWrap: "wrap", gap: "12px", color: "#6a7a67", fontSize: "13px" },
  traceChipRail: { display: "flex", flexWrap: "wrap", gap: "8px" },
  traceChip: { padding: "6px 10px", borderRadius: "999px", background: "#f6f8f5", color: "#3b4a3a", fontSize: "12px", border: "1px solid rgba(17,22,18,0.08)" },
  traceChipValid: { background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0" },
  traceChipSoon: { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" },
  traceChipHigh: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  reviewGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.95fr)", gap: "18px", alignItems: "stretch" },
  sideStack: { display: "grid", gap: "18px", alignSelf: "stretch", height: "100%" },
  sidePanel: { display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: "16px", minHeight: 0, padding: "24px", borderRadius: "28px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" },
  reviewItem: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17, 22, 18, 0.08)" },
  summaryLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  summaryValue: { color: "#152117", fontSize: "15px" },
  noteCard: { display: "grid", gap: "8px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(240,253,244,0.92), rgba(255,255,255,0.98))", border: "1px solid rgba(134, 239, 172, 0.8)" },
  noteTitle: { color: "#14532d", fontSize: "15px" },
  noteText: { margin: 0, color: "#45624a", lineHeight: 1.6 },
  chainBoard: { position: "relative", display: "grid", gap: "16px", padding: "10px 0 4px" },
  chainTrack: { position: "absolute", left: "19px", top: "18px", bottom: "18px", width: "2px", background: "linear-gradient(180deg, rgba(22,101,52,0.18), rgba(22,101,52,0.06))" },
  chainStage: { position: "relative", display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", gap: "14px", alignItems: "start" },
  chainMarkerWrap: { display: "grid", placeItems: "start center", paddingTop: "10px", zIndex: 1 },
  chainMarker: { width: "24px", height: "24px", borderRadius: "999px", display: "grid", placeItems: "center", background: "#ffffff", border: "2px solid rgba(22, 101, 52, 0.18)", color: "#4b5b48", fontSize: "11px", fontWeight: 700 },
  chainMarkerSelected: { background: "#166534", borderColor: "#166534", color: "#fff", boxShadow: "0 10px 20px rgba(22, 101, 52, 0.18)" },
  chainNode: { display: "grid", gap: "10px", padding: "16px 18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 10px 22px rgba(17, 22, 18, 0.05)" },
  chainHeader: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  chainLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#73826f" },
  chainStageTag: { padding: "6px 10px", borderRadius: "999px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: "11px", fontWeight: 700 },
  chainTitle: { color: "#101913", fontSize: "16px" },
  chainMeta: { color: "#5e6d5c", fontSize: "13px" },
  chainChipRail: { display: "flex", flexWrap: "wrap", gap: "8px" },
  detailList: { display: "grid", gap: "12px", alignContent: "space-evenly", minHeight: 0 },
  certListItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "104px", padding: "18px 18px", borderRadius: "18px", background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(252,247,247,0.96))", border: "1px solid rgba(248, 113, 113, 0.18)" },
  commodityListItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "104px", padding: "18px 18px", borderRadius: "18px", background: "linear-gradient(180deg, rgba(248,250,248,1), rgba(240,253,244,0.92))", border: "1px solid rgba(22, 101, 52, 0.12)" },
  siteListItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "92px", padding: "16px 18px", borderRadius: "18px", background: "linear-gradient(180deg, rgba(248,250,252,1), rgba(239,246,255,0.92))", border: "1px solid rgba(37, 99, 235, 0.12)" },
  gapListItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "92px", padding: "16px 18px", borderRadius: "18px", background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(255,251,235,0.92))", border: "1px solid rgba(245, 158, 11, 0.18)" },
  evidenceItem: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", padding: "16px 18px", borderRadius: "18px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)" },
  historyMiniItem: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)" },
  decisionBox: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  journeyRail: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" },
  journeyStep: { display: "grid", gap: "7px", padding: "16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)" },
  journeyMarker: { display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "999px", color: "#fff", fontSize: "12px", fontWeight: 900 },
  journeyMarkerComplete: { background: "#16a34a" },
  journeyMarkerReview: { background: "#f59e0b" },
  journeyMarkerGap: { background: "#dc2626" },
  demoCallout: { display: "grid", gap: "5px", padding: "16px", borderRadius: "16px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#7c2d12" },
  comparatorCard: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px", borderRadius: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0" },
  mapPanel: { display: "grid", gap: "12px", padding: "14px", borderRadius: "18px", background: "linear-gradient(180deg, #eef6f0, #f8fafc)", border: "1px solid rgba(22,101,52,0.12)" },
  mapGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: "10px", minHeight: "150px", alignItems: "center" },
  mapMarker: { display: "grid", gap: "5px", justifyItems: "start", padding: "12px", borderRadius: "14px", background: "#fff", border: "1px solid rgba(17,22,18,0.08)", color: "#152117" },
  mapMarkerDot: { display: "grid", placeItems: "center", width: "24px", height: "24px", borderRadius: "999px", background: "#16a34a", color: "#fff", fontSize: "12px", fontWeight: 800 },
  polygonTileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px" },
  polygonTile: { display: "grid", gap: "8px", padding: "10px", borderRadius: "16px", background: "#ffffff", border: "1px solid rgba(15, 23, 42, 0.1)" },
  polygonTileMeta: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", color: "#475569", fontSize: "12px" },
  polygonSvg: { width: "100%", minHeight: "150px", borderRadius: "12px", background: "linear-gradient(180deg, #dff0e6, #f8fafc)", border: "1px solid rgba(15, 23, 42, 0.08)" },
  polygonLabel: { fontSize: "10px", fontWeight: 800, fill: "#0f172a" },
  mapLegend: { display: "flex", flexWrap: "wrap", gap: "10px", color: "#475569", fontSize: "12px" },
  legendDot: { display: "inline-block", width: "9px", height: "9px", borderRadius: "999px", marginRight: "5px" },
  emptyState: { padding: "18px", borderRadius: "18px", background: "#f8fafc", border: "1px dashed rgba(17, 22, 18, 0.16)", color: "#64748b", fontSize: "13px" },
  certListName: { color: "#101913", fontSize: "14px" },
  certListMeta: { marginTop: "4px", color: "#6a7a67", fontSize: "12px" },
  historyList: { display: "grid", gap: "10px" },
  historyRow: { display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(3, minmax(120px, 0.8fr))", gap: "14px", alignItems: "center", padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17, 22, 18, 0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,247,0.96))" },
  historyPrimary: { display: "grid", gap: "4px" },
  queueName: { fontSize: "15px", color: "#101913" },
  queueMeta: { fontSize: "12px", color: "#6a7a67" },
  historyMetric: { color: "#415240", fontSize: "14px" },
  statusBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 10px", borderRadius: "999px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" },
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.flowBannerItem}>
      <span style={styles.flowBannerLabel}>{label}</span>
      <strong style={styles.flowBannerValue}>{value}</strong>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.reviewItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function JourneyStep({ index, title, detail, state }: { index: number; title: string; detail: string; state: "complete" | "review" | "gap" }) {
  const tone =
    state === "complete"
      ? styles.journeyMarkerComplete
      : state === "review"
        ? styles.journeyMarkerReview
        : styles.journeyMarkerGap;
  return (
    <div style={styles.journeyStep}>
      <span style={{ ...styles.journeyMarker, ...tone }}>{index}</span>
      <strong style={styles.certListName}>{title}</strong>
      <span style={styles.certListMeta}>{detail}</span>
    </div>
  );
}

function ChainStage({ index, eyebrow, tag, title, meta, chips, selected = false }: { index: number; eyebrow: string; tag: string; title: string; meta?: string; chips?: Array<{ label: string; tone?: "high" | "medium" | "low" }>; selected?: boolean; }) {
  return (
    <div style={styles.chainStage}>
      <div style={styles.chainMarkerWrap}>
        <span style={{ ...styles.chainMarker, ...(selected ? styles.chainMarkerSelected : {}) }}>{index}</span>
      </div>
      <div style={styles.chainNode}>
        <div style={styles.chainHeader}>
          <span style={styles.chainLabel}>{eyebrow}</span>
          <span style={styles.chainStageTag}>{tag}</span>
        </div>
        <strong style={styles.chainTitle}>{title}</strong>
        {meta ? <span style={styles.chainMeta}>{meta}</span> : null}
        {chips?.length ? (
          <div style={styles.chainChipRail}>
            {chips.map((chip) => (
              <span key={chip.label} style={{ ...styles.traceChip, ...(chip.tone === "high" ? styles.traceChipHigh : chip.tone === "medium" ? styles.traceChipSoon : chip.tone === "low" ? styles.traceChipValid : {}) }}>{chip.label}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GeoJsonPolygonMap({ sites }: { sites: TraceSite[] }) {
  const drawableSites = sites.filter((site) => site.polygon?.coordinates?.[0]?.length);
  if (!drawableSites.length) {
    return <div style={styles.emptyState}>No GeoJSON polygons are available for this supplier.</div>;
  }

  return (
    <div style={styles.polygonTileGrid}>
      {drawableSites.map((site, index) => (
        <PolygonTile key={site.siteId} site={site} index={index + 1} />
      ))}
    </div>
  );
}

function PolygonTile({ site, index }: { site: TraceSite; index: number }) {
  const ring = site.polygon?.coordinates?.[0] ?? [];
  const longitudes = ring.map((point) => point[0]);
  const latitudes = ring.map((point) => point[1]);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const width = 240;
  const height = 150;
  const padding = 18;
  const lngSpan = maxLng - minLng || 1;
  const latSpan = maxLat - minLat || 1;

  function project(point: number[]) {
    const x = padding + ((point[0] - minLng) / lngSpan) * (width - padding * 2);
    const y = height - padding - ((point[1] - minLat) / latSpan) * (height - padding * 2);
    return `${x},${y}`;
  }

  return (
    <div style={styles.polygonTile}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${site.siteName} GeoJSON polygon`} style={styles.polygonSvg}>
        <polygon points={ring.map(project).join(" ")} fill={getPolygonFill(site)} stroke={getPolygonStroke(site)} strokeWidth="4" opacity="0.9" />
        <circle cx="26" cy="26" r="12" fill="#ffffff" stroke={getPolygonStroke(site)} strokeWidth="2" />
        <text x="26" y="30" textAnchor="middle" style={styles.polygonLabel}>{index}</text>
      </svg>
      <div style={styles.polygonTileMeta}>
        <strong>{site.region || site.country}</strong>
        <span>{site.polygon?.polygonId || site.siteId}</span>
      </div>
    </div>
  );
}

function getRiskBadgeStyle(riskLevel: string) {
  if (riskLevel === "High") return styles.statusBadgeHigh;
  if (riskLevel === "Medium") return styles.statusBadgeSoon;
  return styles.statusBadgeVerified;
}

function getEvidenceBadgeStyle(status: string) {
  if (["Complete", "Available", "Clear", "Ready", "Not Required"].includes(status)) {
    return styles.statusBadgeVerified;
  }
  if (["Partial", "Needs Review", "Expiring soon", "In Review"].includes(status)) {
    return styles.statusBadgeSoon;
  }
  return styles.statusBadgeHigh;
}

function getGapBadgeStyle(severity: string) {
  if (severity === "Critical" || severity === "High") return styles.statusBadgeHigh;
  if (severity === "Medium") return styles.statusBadgeSoon;
  return styles.statusBadgeVerified;
}

function getMapMarkerStyle(site: TraceSite) {
  if (site.deforestationRiskStatus === "High Risk" || site.geoEvidenceStatus === "Missing" || site.polygonEvidenceStatus === "Missing") {
    return { borderColor: "rgba(220,38,38,0.3)", boxShadow: "inset 4px 0 0 #dc2626" };
  }
  if (site.deforestationRiskStatus === "Needs Review" || site.polygonEvidenceStatus === "Needs Review") {
    return { borderColor: "rgba(245,158,11,0.35)", boxShadow: "inset 4px 0 0 #f59e0b" };
  }
  return { borderColor: "rgba(22,163,74,0.25)", boxShadow: "inset 4px 0 0 #16a34a" };
}

function getPolygonStroke(site: TraceSite) {
  if (site.deforestationRiskStatus === "High Risk" || site.geoEvidenceStatus === "Missing" || site.polygonEvidenceStatus === "Missing") {
    return "#dc2626";
  }
  if (site.deforestationRiskStatus === "Needs Review" || site.polygonEvidenceStatus === "Needs Review") {
    return "#f59e0b";
  }
  return "#16a34a";
}

function getPolygonFill(site: TraceSite) {
  if (site.deforestationRiskStatus === "High Risk" || site.geoEvidenceStatus === "Missing" || site.polygonEvidenceStatus === "Missing") {
    return "#fecaca";
  }
  if (site.deforestationRiskStatus === "Needs Review" || site.polygonEvidenceStatus === "Needs Review") {
    return "#fde68a";
  }
  return "#bbf7d0";
}
