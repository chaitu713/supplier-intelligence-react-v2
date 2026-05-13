import { useEffect, useMemo, useState } from "react";
import { AiProvenanceBadge } from "../components/common/AiProvenanceBadge";

const TABS = [
  { id: "document", label: "Document Upload" },
  { id: "mapping", label: "Commodities & Certifications" },
  { id: "supplier", label: "Supplier Details" },
  { id: "review", label: "Review & Submit" },
  { id: "revalidation", label: "Active Supplier Revalidation" },
];

const COMMODITY_OPTIONS = [
  { id: 1, name: "Palm Oil", riskLevel: "High", deforestationRiskScore: 0.8033 },
  { id: 2, name: "Cocoa", riskLevel: "High", deforestationRiskScore: 0.6137 },
  { id: 3, name: "Coffee", riskLevel: "Medium", deforestationRiskScore: 0.3972 },
  { id: 4, name: "Rubber", riskLevel: "Medium", deforestationRiskScore: 0.8694 },
  { id: 5, name: "Wood", riskLevel: "Medium", deforestationRiskScore: 0.3357 },
  { id: 6, name: "Soya", riskLevel: "High", deforestationRiskScore: 0.8319 },
];

const EUDR_COMMODITIES = new Set(["Palm Oil", "Cocoa", "Coffee", "Rubber", "Wood", "Soya"]);
const HIGH_LAND_RISK_COUNTRIES = new Set(["Brazil", "Indonesia", "Malaysia", "Thailand", "Vietnam"]);
const ASSURANCE_CERTIFICATIONS = new Set([
  "Fairtrade",
  "Rainforest Alliance",
  "RSPO",
  "FSC",
  "PEFC",
  "ISO14001",
  "ISO22000",
  "HACCP",
]);

const ESG_SCORE_FIELDS = [
  ["carbon", "Carbon", "environmental"],
  ["water", "Water", "environmental"],
  ["renewable", "Renewable", "environmental"],
  ["waste", "Waste", "environmental"],
  ["land", "Land use", "environmental"],
  ["deforestation", "Deforestation", "environmental"],
  ["labor", "Labor", "social"],
  ["child", "Child risk", "social"],
  ["hours", "Working hours", "social"],
  ["wage", "Wage", "social"],
  ["compliance", "Compliance", "governance"],
  ["transparency", "Transparency", "governance"],
  ["policy", "Policy", "governance"],
  ["reporting", "Reporting", "governance"],
];

const CERTIFICATION_OPTIONS = [
  "RSPO",
  "Rainforest Alliance",
  "FSC",
  "PEFC",
  "Fairtrade",
  "ISO14001",
  "ISO22000",
  "GMP",
  "HACCP",
];

function requiresTraceability(commodityNames) {
  return commodityNames.some((name) => EUDR_COMMODITIES.has(name));
}

function clampScore(value) {
  return String(Math.max(0, Math.min(100, Math.round(value))));
}

function normalizeNames(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildEsgBaselineSuggestion({ country, commodities, certifications, evidenceStatus }) {
  const scores = {
    environmental: { carbon: 48, water: 48, renewable: 50, waste: 46, land: 45, deforestation: 45 },
    social: { labor: 46, child: 44, hours: 42, wage: 44 },
    governance: { compliance: 45, transparency: 48, policy: 48, reporting: 50 },
  };
  const reasons = ["Baseline generated from country, commodity, certification, and evidence context."];
  const commodityNames = normalizeNames(commodities);
  const certificationNames = normalizeNames(certifications);
  const eudrMatches = commodityNames.filter((name) => EUDR_COMMODITIES.has(name));

  if (eudrMatches.length) {
    scores.environmental.land += 18;
    scores.environmental.deforestation += 22;
    scores.governance.compliance += 8;
    scores.governance.transparency += 8;
    reasons.push(`EUDR commodity detected: ${eudrMatches.join(", ")}.`);
  }

  if (HIGH_LAND_RISK_COUNTRIES.has(country)) {
    scores.environmental.land += 8;
    scores.environmental.deforestation += 10;
    reasons.push(`${country} starts with higher land-use monitoring sensitivity.`);
  }

  if (commodityNames.includes("Cocoa")) {
    scores.social.labor += 6;
    scores.social.child += 12;
    scores.social.wage += 6;
    reasons.push("Cocoa adds labor, child-risk, and wage due-diligence sensitivity.");
  }

  if (commodityNames.includes("Palm Oil")) {
    scores.environmental.water += 8;
    scores.environmental.waste += 6;
    reasons.push("Palm oil increases water and waste monitoring sensitivity.");
  }

  if (commodityNames.includes("Coffee")) {
    scores.environmental.water += 7;
    scores.social.wage += 4;
    reasons.push("Coffee adds water and wage-risk monitoring sensitivity.");
  }

  if (commodityNames.includes("Rubber")) {
    scores.environmental.land += 6;
    scores.social.hours += 5;
    reasons.push("Rubber adds land conversion and working-hours sensitivity.");
  }

  const assuranceMatches = certificationNames.filter((name) => ASSURANCE_CERTIFICATIONS.has(name));
  if (assuranceMatches.length) {
    scores.social.labor -= 8;
    scores.social.child -= 8;
    scores.governance.compliance -= 7;
    scores.governance.reporting -= 5;
    reasons.push(`Declared assurance lowers initial risk pending verification: ${assuranceMatches.join(", ")}.`);
  }

  if (evidenceStatus === "Verified") {
    scores.governance.compliance -= 8;
    scores.governance.transparency -= 6;
    scores.governance.reporting -= 6;
    reasons.push("Verified evidence lowers governance uncertainty.");
  } else if (["Expired", "Needs Review"].includes(evidenceStatus)) {
    scores.governance.compliance += 15;
    scores.governance.transparency += 8;
    scores.governance.reporting += 8;
    reasons.push("Evidence review issue raises governance and disclosure risk.");
  } else {
    scores.governance.transparency += 4;
    scores.governance.reporting += 4;
    reasons.push("Scores stay conservative until evidence is verified.");
  }

  const flattenedScores = {};
  ESG_SCORE_FIELDS.forEach(([name, , pillar]) => {
    flattenedScores[name] = clampScore(scores[pillar][name]);
  });

  const scoreValues = Object.values(flattenedScores).map(Number);
  return {
    scores,
    flatScores: flattenedScores,
    reasons,
    confidence: commodityNames.length && country ? "medium" : "low",
    overall: Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length),
  };
}

function flattenBackendBaseline(suggestion) {
  if (!suggestion?.scores) {
    return null;
  }
  return ESG_SCORE_FIELDS.reduce((acc, [name, , pillar]) => {
    const value = suggestion.scores?.[pillar]?.[name];
    if (value !== undefined && value !== null) {
      acc[name] = clampScore(Number(value));
    }
    return acc;
  }, {});
}

function buildOnboardingRequirements({ commodities, certifications, evidenceUploads, requirementUploads, formData }) {
  const commodityNames = normalizeNames(commodities);
  const certificationNames = normalizeNames(certifications);
  const eudrMatches = commodityNames.filter((name) => EUDR_COMMODITIES.has(name));
  const requirements = [];
  const requirementStatus = (id, fieldValue, requestedStatus = "Missing") =>
    requirementUploads?.[id]?.validation_status || (fieldValue === "Yes" || fieldValue === "Complete" ? "Complete" : requestedStatus);

  certificationNames.forEach((name) => {
    const evidence = evidenceUploads[name];
    requirements.push({
      id: `cert-${name}`,
      type: "Certification",
      title: `${name} certificate evidence`,
      reason: "Selected certification must be supported by a valid uploaded document.",
      status: evidence?.validation_status === "Verified" ? "Complete" : evidence ? evidence.validation_status : "Missing",
      required: true,
      canUpload: false,
    });
  });

  if (eudrMatches.length) {
    requirements.push(
      {
        id: "plot-traceability",
        type: "Traceability",
        title: "Plot or farm-level traceability",
        reason: `${eudrMatches.join(", ")} is EUDR relevant and needs upstream origin traceability.`,
        status: requirementStatus("plot-traceability", formData.plot_traceability_available),
        required: true,
        canUpload: true,
      },
      {
        id: "geolocation",
        type: "Traceability",
        title: "Geolocation or polygon evidence",
        reason: "EUDR due diligence requires location evidence for origin risk checks.",
        status: requirementStatus("geolocation", formData.geolocation_evidence_available),
        required: true,
        canUpload: true,
      },
      {
        id: "deforestation-declaration",
        type: "ESG",
        title: "Deforestation-free declaration",
        reason: "Responsible sourcing onboarding needs a formal no-deforestation attestation.",
        status: requirementStatus("deforestation-declaration", formData.deforestation_declaration_available),
        required: true,
        canUpload: true,
      },
    );
  }

  if (formData.supplier_role === "Aggregator" || formData.supplier_role === "Trader") {
    requirements.push({
      id: "chain-of-custody",
      type: "Traceability",
      title: "Chain-of-custody evidence",
      reason: `${formData.supplier_role} suppliers need custody controls between upstream producers and buyers.`,
      status: requirementStatus("chain-of-custody", formData.chain_of_custody_available),
      required: true,
      canUpload: true,
    });
  }

  if (commodityNames.includes("Cocoa") || commodityNames.includes("Coffee")) {
    requirements.push({
      id: "labor-saq",
      type: "Social",
      title: "Labor and child-risk questionnaire",
      reason: `${commodityNames.includes("Cocoa") ? "Cocoa" : "Coffee"} sourcing requires stronger social due-diligence screening.`,
      status: requirementStatus("labor-saq", formData.labor_questionnaire_status, "Requested"),
      required: true,
      canUpload: true,
    });
  }

  if (!requirements.length) {
    requirements.push({
      id: "baseline-profile",
      type: "Baseline",
      title: "Supplier profile and certification review",
      reason: "No commodity-specific evidence trigger was detected yet.",
      status: "Requested",
      required: false,
      canUpload: false,
    });
  }

  const requiredItems = requirements.filter((item) => item.required);
  const completeRequired = requiredItems.filter((item) => item.status === "Complete");
  return {
    requirements,
    totalRequired: requiredItems.length,
    completeRequired: completeRequired.length,
    status:
      requiredItems.length === 0
        ? "Baseline"
        : completeRequired.length === requiredItems.length
          ? "Complete"
          : "Open",
  };
}

function getSuggestedApprovalStatus({ onboardingRequirements, evidenceUploads }) {
  const evidenceValues = Object.values(evidenceUploads || {});
  const hasReviewIssue = evidenceValues.some((item) =>
    ["Expired", "Needs Review"].includes(String(item?.validation_status || "")),
  );
  if (hasReviewIssue) {
    return "Evidence Under Review";
  }
  if (onboardingRequirements.totalRequired > 0 && onboardingRequirements.completeRequired === onboardingRequirements.totalRequired) {
    return "Ready for Approval";
  }
  if (onboardingRequirements.totalRequired > 0) {
    return "Evidence Requested";
  }
  return "Draft";
}

function buildAiOnboardingDecision({ status, onboardingRequirements, evidenceGaps, baselineSuggestion, formData }) {
  const reasons = [];
  const nextActions = [];
  const missingRequirements = onboardingRequirements.requirements.filter((item) => item.required && item.status !== "Complete");

  if (status === "Ready for Approval") {
    reasons.push("All required onboarding evidence checks are complete.");
    reasons.push("No expired or needs-review certification evidence is currently blocking onboarding.");
    nextActions.push("Move supplier to sourcing approval or commercial onboarding.");
  } else if (status === "Evidence Under Review") {
    reasons.push("One or more uploaded evidence documents is expired or requires review.");
    nextActions.push("Request corrected evidence or validate the exception before supplier activation.");
  } else if (status === "Evidence Requested") {
    reasons.push(`${missingRequirements.length} required evidence item${missingRequirements.length === 1 ? "" : "s"} remain open.`);
    nextActions.push("Request the missing traceability, certification, or declaration evidence from the supplier.");
  } else {
    reasons.push("Supplier record is still in draft intake state.");
    nextActions.push("Complete commodity mapping and evidence requirements before onboarding decision.");
  }

  if (formData.eudr_relevant === "Yes") {
    reasons.push("Supplier is EUDR relevant, so traceability evidence is required before approval.");
  }

  if (baselineSuggestion?.overall >= 60) {
    reasons.push(`ESG baseline is elevated at ${baselineSuggestion.overall}/100.`);
    nextActions.push("Keep supplier in monitoring or conditional approval until ESG risk is reduced.");
  } else if (baselineSuggestion?.overall) {
    reasons.push(`ESG baseline is ${baselineSuggestion.overall}/100, within monitorable onboarding range.`);
  }

  evidenceGaps.slice(0, 4).forEach((gap) => nextActions.push(gap));

  return {
    recommendation: status,
    confidence:
      status === "Ready for Approval" && onboardingRequirements.totalRequired > 0
        ? "High"
        : formData.supplier_name && formData.country && selectedTruthy(formData.commodities)
          ? "Medium"
          : "Low",
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    nextActions: Array.from(new Set(nextActions)).slice(0, 5),
  };
}

function selectedTruthy(value) {
  return normalizeNames(value).length > 0;
}

function buildEvidenceGaps({ certificationRows, evidenceUploads, formData }) {
  const gaps = certificationRows.flatMap((row) => {
    const rowGaps = [];
    if (!evidenceUploads[row.name]) rowGaps.push(`${row.name} evidence upload`);
    if (!row.certificate_number) rowGaps.push(`${row.name} certificate number`);
    if (!row.issuing_body) rowGaps.push(`${row.name} issuing body`);
    if (!row.expiry_date) rowGaps.push(`${row.name} expiry date`);
    if (evidenceUploads[row.name]?.validation_status === "Expired") rowGaps.push(`${row.name} is expired`);
    if (evidenceUploads[row.name]?.validation_status === "Needs Review") rowGaps.push(`${row.name} needs review`);
    return rowGaps;
  });
  if (formData.eudr_relevant === "Yes" && formData.traceability_required !== "Yes") {
    gaps.push("EUDR relevant suppliers should require traceability");
  }
  return gaps;
}

const emptyForm = {
  supplier_name: "",
  country: "",
  commodities: "",
  certifications: "",
  tier: "Tier 2",
  parent_supplier_id: "",
  size: "Medium",
  annual_revenue: "",
  onboarding_date: new Date().toISOString().slice(0, 10),
  status: "Pending",
  esg_baseline_date: new Date().toISOString().slice(0, 10),
  evidence_status: "Intake Started",
  eudr_relevant: "No",
  traceability_required: "No",
  site_region: "",
  supplier_role: "Producer",
  plot_traceability_available: "No",
  geolocation_evidence_available: "No",
  chain_of_custody_available: "No",
  deforestation_declaration_available: "No",
  labor_questionnaire_status: "Requested",
  traceability_notes: "",
  approval_status: "Draft",
  approval_conditions: "",
  approval_blockers: "",
  carbon: "50",
  water: "50",
  renewable: "50",
  waste: "50",
  land: "50",
  deforestation: "50",
  labor: "50",
  child: "50",
  hours: "50",
  wage: "50",
  compliance: "50",
  transparency: "50",
  policy: "50",
  reporting: "50",
};

export default function OnboardingPage({ embedded = false } = {}) {
  const [activeTab, setActiveTab] = useState("document");
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submittedSupplierId, setSubmittedSupplierId] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
  const [certificationRows, setCertificationRows] = useState([]);
  const [evidenceUploads, setEvidenceUploads] = useState({});
  const [requirementUploads, setRequirementUploads] = useState({});
  const [evidenceUploadState, setEvidenceUploadState] = useState({});
  const [requirementUploadState, setRequirementUploadState] = useState({});
  const [baselineSuggestion, setBaselineSuggestion] = useState(null);
  const [llmDecision, setLlmDecision] = useState(null);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [aiAssistance, setAiAssistance] = useState(null);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [traceabilitySuppliers, setTraceabilitySuppliers] = useState([]);
  const [revalidationSupplierId, setRevalidationSupplierId] = useState("");
  const [revalidationOutcome, setRevalidationOutcome] = useState("Revalidation Requested");
  const [revalidationNotes, setRevalidationNotes] = useState("");
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [revalidationMessage, setRevalidationMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSuppliers() {
      const [supplierResult, traceabilityResult] = await Promise.allSettled([
        fetch("http://localhost:8000/suppliers"),
        fetch("http://localhost:8000/traceability/workspace"),
      ]);

      if (cancelled) {
        return;
      }

      if (supplierResult.status === "fulfilled" && supplierResult.value.ok) {
        const supplierPayload = await supplierResult.value.json();
        setSupplierOptions(Array.isArray(supplierPayload) ? supplierPayload : []);
      } else {
        setSupplierOptions([]);
      }

      if (traceabilityResult.status === "fulfilled" && traceabilityResult.value.ok) {
        const traceabilityPayload = await traceabilityResult.value.json();
        setTraceabilitySuppliers(
          Array.isArray(traceabilityPayload?.suppliers) ? traceabilityPayload.suppliers : [],
        );
      } else {
        setTraceabilitySuppliers([]);
      }
    }

    loadSuppliers();

    return () => {
      cancelled = true;
    };
  }, []);

  const supplierRequiredFields = [
    ["Supplier name", formData.supplier_name],
    ["Country", formData.country],
    ["Tier", formData.tier],
    ["Size", formData.size],
    ["Onboarding date", formData.onboarding_date],
    ["Status", formData.status],
  ];
  const needsLinkedSupplier = formData.tier === "Tier 2" || formData.tier === "Tier 3";
  const linkedSupplierTier =
    formData.tier === "Tier 2" ? "Tier 1" : formData.tier === "Tier 3" ? "Tier 2" : null;

  const supplierCompletionCount = supplierRequiredFields.filter(([, value]) => Boolean(value)).length;
  const supplierCompletion = Math.round(
    ((supplierCompletionCount + (needsLinkedSupplier ? (formData.parent_supplier_id ? 1 : 0) : 0)) /
      (supplierRequiredFields.length + (needsLinkedSupplier ? 1 : 0))) *
      100,
  );

  const extractedFields = [
    ["Supplier name", formData.supplier_name || "Not detected"],
    ["Country", formData.country || "Not detected"],
    ["Commodities", formData.commodities || "Not detected"],
    ["Certifications", formData.certifications || "Not detected"],
  ];

  const selectedCommodityNames = formData.commodities
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const activeSupplierOptions = useMemo(
    () => supplierOptions.filter((supplier) => String(supplier.status || "").toLowerCase() === "active"),
    [supplierOptions],
  );
  const selectedRevalidationSupplier = activeSupplierOptions.find(
    (supplier) => String(supplier.supplier_id) === String(revalidationSupplierId),
  );
  const selectedCertificationNames = formData.certifications
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const currentCommoditySet = new Set(selectedCommodityNames.map((item) => item.toLowerCase()));
  const supplierDirectory = useMemo(() => {
    const traceabilityFallback = traceabilitySuppliers.map((supplier) => ({
      supplier_id: supplier.supplierId,
      supplier_name: supplier.supplierName,
      country: supplier.country,
      tier: supplier.tier,
    }));

    const combined = [...supplierOptions, ...traceabilityFallback];
    const seen = new Set();

    return combined.filter((supplier) => {
      const key = String(supplier.supplier_id ?? supplier.supplierId ?? "");
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [supplierOptions, traceabilitySuppliers]);
  const linkedSupplierOptions = useMemo(
    () => {
      if (!linkedSupplierTier) {
        return [];
      }

      const rankedSuppliers = supplierDirectory
        .filter((supplier) => supplier.tier === linkedSupplierTier)
        .map((supplier) => {
          const traceSupplier = traceabilitySuppliers.find(
            (item) => Number(item.supplierId) === Number(supplier.supplier_id),
          );
          const supplierCommodityNames = Array.isArray(traceSupplier?.commodities)
            ? traceSupplier.commodities.map((commodity) => String(commodity.name).toLowerCase())
            : [];
          const overlapCount =
            currentCommoditySet.size === 0
              ? 0
              : supplierCommodityNames.filter((name) => currentCommoditySet.has(name)).length;

          return {
            supplier,
            overlapCount,
          };
        })
        .sort((left, right) => right.overlapCount - left.overlapCount);

      const overlappingSuppliers = rankedSuppliers
        .filter((entry) => entry.overlapCount > 0)
        .map((entry) => entry.supplier);

      if (overlappingSuppliers.length > 0) {
        return overlappingSuppliers;
      }

      return rankedSuppliers.map((entry) => entry.supplier);
    },
    [currentCommoditySet, linkedSupplierTier, supplierDirectory, traceabilitySuppliers],
  );
  const linkedSupplierName =
    supplierDirectory.find((supplier) => String(supplier.supplier_id) === formData.parent_supplier_id)
      ?.supplier_name ?? "";
  const selectedCommodities = COMMODITY_OPTIONS.filter((item) =>
    selectedCommodityNames.includes(item.name),
  );
  const onboardingRequirements = useMemo(
    () =>
      buildOnboardingRequirements({
        commodities: selectedCommodityNames,
        certifications: selectedCertificationNames,
        evidenceUploads,
        requirementUploads,
        formData,
      }),
    [
      selectedCommodityNames,
      selectedCertificationNames,
      evidenceUploads,
      requirementUploads,
      formData.plot_traceability_available,
      formData.geolocation_evidence_available,
      formData.chain_of_custody_available,
      formData.deforestation_declaration_available,
      formData.labor_questionnaire_status,
      formData.supplier_role,
    ],
  );
  const suggestedApprovalStatus = useMemo(
    () => getSuggestedApprovalStatus({ onboardingRequirements, evidenceUploads }),
    [onboardingRequirements, evidenceUploads],
  );
  const evidenceGaps = useMemo(
    () => buildEvidenceGaps({ certificationRows, evidenceUploads, formData }),
    [
      certificationRows,
      evidenceUploads,
      formData.eudr_relevant,
      formData.traceability_required,
    ],
  );
  const deterministicDecision = useMemo(
    () =>
      buildAiOnboardingDecision({
        status: suggestedApprovalStatus,
        onboardingRequirements,
        evidenceGaps,
        baselineSuggestion,
        formData,
      }),
    [suggestedApprovalStatus, onboardingRequirements, evidenceGaps, baselineSuggestion, formData],
  );
  const averageDeforestationRisk = selectedCommodities.length
    ? (
        selectedCommodities.reduce((sum, item) => sum + item.deforestationRiskScore, 0) /
        selectedCommodities.length
      ).toFixed(2)
    : null;
  const reviewReady =
    supplierCompletion === 100 &&
    selectedCommodityNames.length > 0 &&
    Boolean(formData.supplier_name) &&
    Boolean(formData.country);

  async function handleUpload() {
    if (!selectedFile) {
      setErrorMessage("Please select a file before uploading.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const payload = new FormData();
      payload.append("file", selectedFile);

      const response = await fetch("http://localhost:8000/onboarding/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Failed to upload and extract document."));
      }

      const result = await response.json();
      setExtractedData(result);
      setValidationData(result?.validation ?? { is_valid: false, errors: [], warnings: [] });
      setAiAssistance(result?.ai_assistance ?? null);
      const extractedCommodities = Array.isArray(result?.commodities) ? result.commodities : [];
      const shouldRequireTraceability = requiresTraceability(extractedCommodities);
      const generatedBaseline =
        result?.esg_baseline_suggestion ??
        buildEsgBaselineSuggestion({
          country: result?.country ?? "",
          commodities: extractedCommodities,
          certifications: result?.certifications ?? [],
          evidenceStatus: "Baseline Created",
        });
      const baselineScores =
        flattenBackendBaseline(generatedBaseline) ?? generatedBaseline.flatScores ?? {};
      setBaselineSuggestion(generatedBaseline);
      setFormData({
        ...emptyForm,
        supplier_name: result?.supplier_name ?? "",
        country: result?.country ?? "",
        site_region: result?.country ?? "",
        commodities: extractedCommodities.join(", "),
        certifications: Array.isArray(result?.certifications)
          ? result.certifications.join(", ")
          : "",
        eudr_relevant: shouldRequireTraceability ? "Yes" : "No",
        traceability_required: shouldRequireTraceability ? "Yes" : "No",
        evidence_status: "Baseline Created",
        approval_status: shouldRequireTraceability ? "Evidence Requested" : "Draft",
        approval_blockers: shouldRequireTraceability ? "Traceability and evidence checklist must be completed before approval." : "",
        ...baselineScores,
      });
      setCertificationRows(
        (Array.isArray(result?.certifications) ? result.certifications : []).map((name) => ({
          name,
          issue_date: "",
          expiry_date: "",
          status: "Pending",
          certificate_number: "",
          issuing_body: "",
          scope: "",
        })),
      );
      setShowRawText(false);
      setSubmissionMessage("");
      setSubmittedSupplierId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong during upload.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmitSupplier() {
    setIsSubmitting(true);
    setErrorMessage("");
    setSubmissionMessage("");
    setSubmittedSupplierId(null);

    try {
      if (formData.status !== "Pending") {
        throw new Error(
          "This onboarding workflow is only for suppliers in Pending status. Active suppliers should be handled through ESG monitoring or supplier refresh.",
        );
      }

      const payload = new FormData();
      payload.append("supplier_name", formData.supplier_name);
      payload.append("country", formData.country);
      payload.append("tier", formData.tier);
      payload.append("size", formData.size);
      payload.append("annual_revenue", formData.annual_revenue);
      payload.append("onboarding_date", formData.onboarding_date);
      payload.append("status", formData.status);
      payload.append("parent_supplier_id", formData.parent_supplier_id);
      payload.append("esg_baseline_date", formData.esg_baseline_date);
      payload.append("evidence_status", formData.evidence_status);
      payload.append("eudr_relevant", formData.eudr_relevant);
      payload.append("traceability_required", formData.traceability_required);
      payload.append("site_region", formData.site_region);
      payload.append("supplier_role", formData.supplier_role);
      payload.append("plot_traceability_available", formData.plot_traceability_available);
      payload.append("geolocation_evidence_available", formData.geolocation_evidence_available);
      payload.append("chain_of_custody_available", formData.chain_of_custody_available);
      payload.append("deforestation_declaration_available", formData.deforestation_declaration_available);
      payload.append("labor_questionnaire_status", formData.labor_questionnaire_status);
      payload.append("traceability_notes", formData.traceability_notes);
      payload.append("onboarding_requirements_json", JSON.stringify(onboardingRequirements));
      payload.append("approval_status", formData.approval_status || suggestedApprovalStatus);
      payload.append("approval_conditions", formData.approval_conditions);
      payload.append("approval_blockers", formData.approval_blockers);
      payload.append("carbon", formData.carbon);
      payload.append("water", formData.water);
      payload.append("renewable", formData.renewable);
      payload.append("waste", formData.waste);
      payload.append("land", formData.land);
      payload.append("deforestation", formData.deforestation);
      payload.append("labor", formData.labor);
      payload.append("child", formData.child);
      payload.append("hours", formData.hours);
      payload.append("wage", formData.wage);
      payload.append("compliance", formData.compliance);
      payload.append("transparency", formData.transparency);
      payload.append("policy", formData.policy);
      payload.append("reporting", formData.reporting);
      payload.append("commodities", JSON.stringify(selectedCommodityNames));
      payload.append("certifications", JSON.stringify(selectedCertificationNames));
      payload.append("certification_rows", JSON.stringify(certificationRows));

      const response = await fetch("http://localhost:8000/onboarding/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Failed to submit supplier onboarding."));
      }

      const result = await response.json();
      setSubmissionMessage(result?.message ?? "Supplier onboarded successfully");
      setSubmittedSupplierId(result?.supplier_id ?? null);
      setAiAssistance(result?.ai_assistance ?? null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to submit supplier onboarding.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateSupplier() {
    if (!submittedSupplierId) {
      return;
    }

    setIsActivating(true);
    setErrorMessage("");

    try {
      const response = await fetch("http://localhost:8000/onboarding/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: submittedSupplierId }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Failed to activate supplier."));
      }

      const result = await response.json();
      setFormData((current) => ({
        ...current,
        status: result.status || "Active",
        approval_status: result.approval_status || "Approved",
        evidence_status: "Verified",
      }));
      setSubmissionMessage(result.message || "Supplier approved and activated");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to activate supplier.");
    } finally {
      setIsActivating(false);
    }
  }

  async function handleRevalidateSupplier() {
    if (!revalidationSupplierId) {
      setErrorMessage("Select an active supplier before updating revalidation.");
      return;
    }

    setIsRevalidating(true);
    setErrorMessage("");
    setRevalidationMessage("");

    try {
      const response = await fetch("http://localhost:8000/onboarding/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: Number(revalidationSupplierId),
          outcome: revalidationOutcome,
          notes: revalidationNotes,
        }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Failed to update supplier revalidation."));
      }

      const result = await response.json();
      setSupplierOptions((current) =>
        current.map((supplier) =>
          String(supplier.supplier_id) === String(result.supplier_id)
            ? {
                ...supplier,
                status: result.status,
              }
            : supplier,
        ),
      );
      setRevalidationMessage(
        `${result.message}: ${result.approval_status} (${result.evidence_status})`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update supplier revalidation.");
    } finally {
      setIsRevalidating(false);
    }
  }

  function handleUseExtractedData() {
    if (extractedData) {
      setActiveTab("mapping");
    }
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      ...(name === "tier" && value === "Tier 1" ? { parent_supplier_id: "" } : {}),
      [name]: value,
    }));
  }

  function handleCommodityToggle(name) {
    const nextValues = selectedCommodityNames.includes(name)
      ? selectedCommodityNames.filter((item) => item !== name)
      : [...selectedCommodityNames, name];
    const shouldRequireTraceability = requiresTraceability(nextValues);
    const nextBaseline = buildEsgBaselineSuggestion({
      country: formData.country,
      commodities: nextValues,
      certifications: selectedCertificationNames,
      evidenceStatus: formData.evidence_status,
    });
      setBaselineSuggestion(nextBaseline);
    setLlmDecision(null);

    setFormData((current) => ({
      ...current,
      commodities: nextValues.join(", "),
      eudr_relevant: shouldRequireTraceability ? "Yes" : "No",
      traceability_required: shouldRequireTraceability ? "Yes" : "No",
      ...nextBaseline.flatScores,
    }));
  }

  function handleCertificationToggle(name) {
    const exists = selectedCertificationNames.includes(name);
    const nextValues = exists
      ? selectedCertificationNames.filter((item) => item !== name)
      : [...selectedCertificationNames, name];
    const nextBaseline = buildEsgBaselineSuggestion({
      country: formData.country,
      commodities: selectedCommodityNames,
      certifications: nextValues,
      evidenceStatus: formData.evidence_status,
    });
    setBaselineSuggestion(nextBaseline);
    setLlmDecision(null);

    setFormData((current) => ({
      ...current,
      certifications: nextValues.join(", "),
      ...nextBaseline.flatScores,
    }));

    setCertificationRows((current) => {
      if (exists) {
        return current.filter((row) => row.name !== name);
      }
      return [...current, {
        name,
        issue_date: "",
        expiry_date: "",
        status: "Pending",
        certificate_number: "",
        issuing_body: "",
        scope: "",
      }];
    });
  }

  function handleCertificationRowChange(name, field, value) {
    setCertificationRows((current) =>
      current.map((row) => (row.name === name ? { ...row, [field]: value } : row)),
    );
  }

  async function handleEvidenceUpload(certificationName, file) {
    if (!file) {
      return;
    }
    setEvidenceUploadState((current) => ({ ...current, [certificationName]: "Uploading" }));
    setErrorMessage("");

    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("evidence_type", "Certification");
      payload.append("linked_entity_type", "Certification");
      payload.append("linked_entity_name", certificationName);
      payload.append("temporary_supplier_key", formData.supplier_name || "draft_supplier");

      const response = await fetch("http://localhost:8000/onboarding/evidence/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Failed to upload certification evidence."));
      }

      const result = await response.json();
      setLlmDecision(null);
      setEvidenceUploads((current) => ({ ...current, [certificationName]: result }));
      setEvidenceUploadState((current) => ({ ...current, [certificationName]: "Uploaded" }));
      const nextEvidenceStatus =
        result.validation_status === "Verified"
          ? "Verified"
          : result.validation_status === "Expired" || result.validation_status === "Needs Review"
            ? result.validation_status
            : "Evidence Received";
      const nextBaseline = buildEsgBaselineSuggestion({
        country: formData.country,
        commodities: selectedCommodityNames,
        certifications: selectedCertificationNames,
        evidenceStatus: nextEvidenceStatus,
      });
      setBaselineSuggestion(nextBaseline);
      setFormData((current) => ({
        ...current,
        site_region: current.site_region || result.extracted_scope_site || "",
      evidence_status: nextEvidenceStatus,
        approval_status:
          nextEvidenceStatus === "Expired" || nextEvidenceStatus === "Needs Review"
            ? "Evidence Under Review"
            : current.approval_status,
        approval_blockers:
          nextEvidenceStatus === "Expired" || nextEvidenceStatus === "Needs Review"
            ? `${certificationName} evidence requires business review.`
            : current.approval_blockers,
        ...nextBaseline.flatScores,
      }));
      setCertificationRows((current) =>
        current.map((row) =>
          row.name === certificationName
            ? {
                ...row,
                certificate_number: result.extracted_certificate_number || row.certificate_number || "",
                issuing_body: result.extracted_issuer || row.issuing_body || "",
                issue_date: result.extracted_issue_date || row.issue_date || "",
                expiry_date: result.extracted_expiry_date || row.expiry_date || "",
                scope: result.extracted_scope_site || row.scope || "",
                evidence_id: result.evidence_id || row.evidence_id || "",
                validation_status: result.validation_status || row.validation_status || "",
                status: result.validation_status === "Verified" ? "Verified" : row.status,
              }
            : row,
        ),
      );
    } catch (error) {
      setEvidenceUploadState((current) => ({ ...current, [certificationName]: "Failed" }));
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload evidence.");
    }
  }

  async function handleRequirementUpload(requirement, file) {
    if (!file) {
      return;
    }
    setRequirementUploadState((current) => ({ ...current, [requirement.id]: "Uploading" }));
    setErrorMessage("");

    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("evidence_type", requirement.type);
      payload.append("linked_entity_type", "Onboarding Requirement");
      payload.append("linked_entity_name", requirement.title);
      payload.append("temporary_supplier_key", formData.supplier_name || "draft_supplier");

      const response = await fetch("http://localhost:8000/onboarding/evidence/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Failed to upload requirement evidence."));
      }

      const result = await response.json();
      const requirementStatus =
        result.validation_status === "Complete" || result.validation_status === "Verified"
          ? "Complete"
          : "Needs Review";
      const uploadRecord = {
        ...result,
        validation_status: requirementStatus,
        validation_notes: result.validation_notes || "Requirement evidence uploaded.",
      };
      setRequirementUploads((current) => ({ ...current, [requirement.id]: uploadRecord }));
      setRequirementUploadState((current) => ({ ...current, [requirement.id]: "Uploaded" }));
      setLlmDecision(null);

      setFormData((current) => {
        const next = { ...current };
        const isComplete = requirementStatus === "Complete";
        if (requirement.id === "plot-traceability") next.plot_traceability_available = isComplete ? "Yes" : "No";
        if (requirement.id === "geolocation") next.geolocation_evidence_available = isComplete ? "Yes" : "No";
        if (requirement.id === "deforestation-declaration") next.deforestation_declaration_available = isComplete ? "Yes" : "No";
        if (requirement.id === "chain-of-custody") next.chain_of_custody_available = isComplete ? "Yes" : "No";
        if (requirement.id === "labor-saq") next.labor_questionnaire_status = isComplete ? "Complete" : "Needs Review";
        next.evidence_status =
          current.evidence_status === "Verified"
            ? "Verified"
            : isComplete
              ? "Evidence Received"
              : "Needs Review";
        next.approval_status = isComplete ? current.approval_status : "Evidence Under Review";
        return next;
      });
    } catch (error) {
      setRequirementUploadState((current) => ({ ...current, [requirement.id]: "Failed" }));
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload requirement evidence.");
    }
  }

  async function handleGenerateAiDecision(deterministicDecision, evidenceGaps) {
    setIsDecisionLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("http://localhost:8000/onboarding/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            supplier: {
              name: formData.supplier_name,
              country: formData.country,
              tier: formData.tier,
              role: formData.supplier_role,
            },
            commodities: selectedCommodityNames,
            certifications: selectedCertificationNames,
            evidenceUploads,
            evidenceGaps,
            onboardingRequirements,
            esgBaseline: baselineSuggestion,
            traceability: {
              eudrRelevant: formData.eudr_relevant,
              traceabilityRequired: formData.traceability_required,
              plotTraceability: formData.plot_traceability_available,
              geolocationEvidence: formData.geolocation_evidence_available,
              chainOfCustody: formData.chain_of_custody_available,
              deforestationDeclaration: formData.deforestation_declaration_available,
              laborQuestionnaire: formData.labor_questionnaire_status,
            },
            deterministic_decision: deterministicDecision,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Unable to generate AI onboarding decision."));
      }
      const result = await response.json();
      setLlmDecision(result);
      setFormData((current) => ({
        ...current,
        approval_status: result.recommendation || deterministicDecision.recommendation,
        approval_conditions:
          current.approval_conditions || (Array.isArray(result.nextActions) ? result.nextActions.join("\n") : ""),
        approval_blockers:
          result.recommendation === "Ready for Approval"
            ? ""
            : current.approval_blockers || (Array.isArray(result.nextActions) ? result.nextActions.join("\n") : ""),
      }));
    } catch (error) {
      setLlmDecision({ ...deterministicDecision, source: "deterministic_fallback" });
      setFormData((current) => ({
        ...current,
        approval_status: deterministicDecision.recommendation,
        approval_conditions: current.approval_conditions || deterministicDecision.nextActions.join("\n"),
        approval_blockers:
          deterministicDecision.recommendation === "Ready for Approval"
            ? ""
            : current.approval_blockers || deterministicDecision.nextActions.join("\n"),
      }));
    } finally {
      setIsDecisionLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "review" || llmDecision || isDecisionLoading || !formData.supplier_name) {
      return;
    }
    void handleGenerateAiDecision(deterministicDecision, evidenceGaps);
  }, [activeTab, llmDecision, isDecisionLoading, formData.supplier_name]);

  function handleClear() {
    setSelectedFile(null);
    setExtractedData(null);
    setValidationData(null);
    setFormData(emptyForm);
    setErrorMessage("");
    setShowRawText(false);
    setAiAssistance(null);
    setBaselineSuggestion(null);
    setLlmDecision(null);
    setCertificationRows([]);
    setEvidenceUploads({});
    setRequirementUploads({});
    setEvidenceUploadState({});
    setRequirementUploadState({});
    setIsActivating(false);
    setRevalidationSupplierId("");
    setRevalidationOutcome("Revalidation Requested");
    setRevalidationNotes("");
    setRevalidationMessage("");
    setActiveTab("document");
  }

  function renderDocumentTab() {
    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>AI Assisted Onboarding</span>
            <h1 style={styles.heroTitle}>Document intake for supplier onboarding</h1>
            <p style={styles.heroText}>
              Start with one supplier document, extract the `v2` fields we already support,
              validate the output, and hand the data into the onboarding flow.
            </p>
          </div>
          <div style={styles.metricGrid}>
            <Metric value={validationData?.errors?.length ?? 0} label="Errors" />
            <Metric value={validationData?.warnings?.length ?? 0} label="Warnings" />
            <Metric value={selectedFile ? 1 : 0} label="Files queued" />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Upload source document</h2>
              <p style={styles.sectionText}>
                The current extractor reads supplier name, country, commodities, and certifications.
              </p>
            </div>
            <span style={styles.pill}>{selectedFile ? "Ready to process" : "No file selected"}</span>
          </div>

          <div style={styles.uploadCard}>
            <label htmlFor="supplier-upload" style={styles.uploadSurface}>
              <span style={styles.uploadTitle}>Select supplier document</span>
              <span style={styles.uploadText}>
                {selectedFile?.name || "PDF upload only. Extraction runs as soon as you pick a file."}
              </span>
              <input
                id="supplier-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                style={styles.hiddenInput}
              />
            </label>
            <p style={styles.hint}>
              Best results come from documents that clearly mention supplier identity and certificate names.
            </p>

            <div style={styles.summaryGrid}>
              <Summary label="Selected file" value={selectedFile?.name ?? "No file chosen"} />
              <Summary
                label="Extraction status"
                value={
                  isUploading
                    ? "Processing"
                    : extractedData
                      ? validationData?.is_valid
                        ? "Ready for next step"
                        : "Needs review"
                      : "Waiting for upload"
                }
              />
            </div>

            <div style={styles.actions}>
              <button type="button" onClick={handleUpload} disabled={isUploading} className="btn-primary">
                {isUploading ? "Extracting..." : "Upload & Extract"}
              </button>
              <button
                type="button"
                onClick={handleUseExtractedData}
                disabled={!extractedData}
                style={{ ...styles.secondaryButton, ...(!extractedData ? styles.disabledButton : {}) }}
              >
                Use Extracted Data
              </button>
              <button type="button" onClick={handleClear} style={styles.linkButton}>
                Clear
              </button>
            </div>

            {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Extracted field preview</h2>
                <p style={styles.sectionText}>These values will seed the next onboarding tab.</p>
              </div>
              <span style={styles.pillAlt}>{extractedData ? "Extraction received" : "Awaiting extraction"}</span>
            </div>

            <div style={styles.previewGrid}>
              {extractedFields.map(([label, value]) => (
                <div key={label} style={styles.previewCard}>
                  <span style={styles.previewLabel}>{label}</span>
                  <strong style={styles.previewValue}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>ESG monitoring baseline</h2>
                <p style={styles.sectionText}>
                  These fields seed ESG Monitoring and create the supplier baseline for future continuous checks.
                </p>
              </div>
              <span style={styles.pillAlt}>Monitoring ready</span>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label htmlFor="esg_baseline_date" style={styles.label}>ESG baseline date</label>
                <input
                  id="esg_baseline_date"
                  name="esg_baseline_date"
                  type="date"
                  value={formData.esg_baseline_date}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="site_region" style={styles.label}>Site / sourcing region</label>
                <input
                  id="site_region"
                  name="site_region"
                  type="text"
                  value={formData.site_region}
                  onChange={handleFieldChange}
                  placeholder="e.g. Riau, Sumatra"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.systemField}>
                <span style={styles.summaryLabel}>System evidence status</span>
                <strong style={styles.summaryValue}>{formData.evidence_status}</strong>
                <p style={styles.hint}>Updated automatically by extraction, evidence uploads, review, and activation.</p>
              </div>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Validation summary</h2>
                <p style={styles.sectionText}>Keep intake quality tight before moving ahead.</p>
              </div>
            </div>

            {!validationData ? <p style={styles.muted}>No validation data yet.</p> : null}

            {validationData?.errors?.length > 0 ? (
              <div style={styles.validationBlock}>
                <h3 style={styles.errorTitle}>Errors</h3>
                <ul style={styles.list}>
                  {validationData.errors.map((error) => (
                    <li key={error} style={styles.errorItem}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {validationData?.warnings?.length > 0 ? (
              <div style={styles.validationBlock}>
                <h3 style={styles.warningTitle}>Warnings</h3>
                <ul style={styles.list}>
                  {validationData.warnings.map((warning) => (
                    <li key={warning} style={styles.warningItem}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {validationData &&
            (validationData.errors?.length ?? 0) === 0 &&
            (validationData.warnings?.length ?? 0) === 0 ? (
              <p style={styles.success}>All checks passed. This document is ready to drive onboarding.</p>
            ) : null}

            {aiAssistance ? (
              <div style={styles.aiAssistCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.sectionTitle}>AI remediation assist</h3>
                    <p style={styles.sectionText}>{aiAssistance.summary}</p>
                  </div>
                  <div style={styles.provenanceRail}>
                    <AiProvenanceBadge provenance={aiAssistance} />
                    <span style={styles.pillAlt}>
                      {String(aiAssistance.confidence || "medium").toUpperCase()} confidence
                    </span>
                  </div>
                </div>

                <div style={styles.previewGrid}>
                  <div style={styles.previewCard}>
                    <span style={styles.previewLabel}>Suggested supplier name</span>
                    <strong style={styles.previewValue}>
                      {aiAssistance?.suggestedFields?.supplier_name || "No suggestion"}
                    </strong>
                  </div>
                  <div style={styles.previewCard}>
                    <span style={styles.previewLabel}>Suggested country</span>
                    <strong style={styles.previewValue}>
                      {aiAssistance?.suggestedFields?.country || "No suggestion"}
                    </strong>
                  </div>
                  <div style={styles.previewCard}>
                    <span style={styles.previewLabel}>Possible countries</span>
                    <strong style={styles.previewValue}>
                      {Array.isArray(aiAssistance?.suggestedFields?.possibleCountries) &&
                      aiAssistance.suggestedFields.possibleCountries.length > 0
                        ? aiAssistance.suggestedFields.possibleCountries.join(", ")
                        : "No ranked options"}
                    </strong>
                  </div>
                  <div style={styles.previewCard}>
                    <span style={styles.previewLabel}>Suggested commodities</span>
                    <strong style={styles.previewValue}>
                      {Array.isArray(aiAssistance?.suggestedFields?.commodities) &&
                      aiAssistance.suggestedFields.commodities.length > 0
                        ? aiAssistance.suggestedFields.commodities.join(", ")
                        : "No suggestion"}
                    </strong>
                  </div>
                  <div style={styles.previewCard}>
                    <span style={styles.previewLabel}>Suggested certifications</span>
                    <strong style={styles.previewValue}>
                      {Array.isArray(aiAssistance?.suggestedFields?.certifications) &&
                      aiAssistance.suggestedFields.certifications.length > 0
                        ? aiAssistance.suggestedFields.certifications.join(", ")
                        : "No suggestion"}
                    </strong>
                  </div>
                </div>

                {Array.isArray(aiAssistance?.actions) && aiAssistance.actions.length > 0 ? (
                  <div style={styles.validationBlock}>
                    <h3 style={styles.warningTitle}>Suggested next actions</h3>
                    <ul style={styles.list}>
                      {aiAssistance.actions.map((action) => (
                        <li key={action} style={styles.warningItem}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {extractedData?.raw_text ? (
              <div style={styles.rawBlock}>
                <button
                  type="button"
                  onClick={() => setShowRawText((current) => !current)}
                  style={styles.linkButton}
                >
                  {showRawText ? "Hide raw extracted text" : "Show raw extracted text"}
                </button>
                {showRawText ? <pre style={styles.pre}>{extractedData.raw_text}</pre> : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderPlaceholder(title, text) {
    return (
      <section style={styles.placeholder}>
        <span style={styles.eyebrow}>Next Build Step</span>
        <h2 style={styles.placeholderTitle}>{title}</h2>
        <p style={styles.placeholderText}>{text}</p>
      </section>
    );
  }

  function renderSupplierTab() {
    const missingFields = supplierRequiredFields.filter(([, value]) => !value).map(([label]) => label);
    if (needsLinkedSupplier && !formData.parent_supplier_id) {
      missingFields.push(`Linked ${linkedSupplierTier} supplier`);
    }

    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>Tab 3</span>
            <h1 style={styles.heroTitle}>Supplier details and onboarding defaults</h1>
            <p style={styles.heroText}>
              Confirm the supplier master record using the document extraction as a starting point,
              then complete the `v2` fields required for onboarding.
            </p>
          </div>
          <div style={styles.metricGrid}>
            <Metric value={`${supplierCompletion}%`} label="Required fields ready" />
            <Metric value={formData.status || "None"} label="Current status" />
            <Metric value={formData.tier || "None"} label="Supplier tier" />
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Core supplier fields</h2>
                <p style={styles.sectionText}>
                  These fields map directly to the supplier master data we already have in `v2`.
                </p>
              </div>
              <span style={styles.pill}>{supplierCompletionCount}/{supplierRequiredFields.length} required complete</span>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label htmlFor="supplier_name" style={styles.label}>Supplier name</label>
                <input
                  id="supplier_name"
                  name="supplier_name"
                  type="text"
                  value={formData.supplier_name}
                  onChange={handleFieldChange}
                  placeholder="Supplier legal or trading name"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="country" style={styles.label}>Country</label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  value={formData.country}
                  onChange={handleFieldChange}
                  placeholder="Country of operation"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="tier" style={styles.label}>Tier</label>
                <select
                  id="tier"
                  name="tier"
                  value={formData.tier}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="Tier 1">Tier 1</option>
                  <option value="Tier 2">Tier 2</option>
                  <option value="Tier 3">Tier 3</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="size" style={styles.label}>Size</label>
                <select
                  id="size"
                  name="size"
                  value={formData.size}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </select>
              </div>

              {needsLinkedSupplier ? (
                <div style={styles.field}>
                  <label htmlFor="parent_supplier_id" style={styles.label}>
                    Linked {linkedSupplierTier} supplier
                  </label>
                  <select
                    id="parent_supplier_id"
                    name="parent_supplier_id"
                    value={formData.parent_supplier_id}
                    onChange={handleFieldChange}
                    style={styles.textInput}
                  >
                    <option value="">Select linked supplier</option>
                    {linkedSupplierOptions.map((supplier) => (
                      <option key={supplier.supplier_id} value={supplier.supplier_id}>
                        {supplier.supplier_name} ({supplier.country})
                      </option>
                    ))}
                  </select>
                  <p style={styles.hint}>
                    {selectedCommodityNames.length === 0
                      ? "Tier-matching suppliers are shown. Add commodities to bring the closest upstream matches to the top."
                      : formData.tier === "Tier 2"
                        ? "Matching Tier 1 suppliers are shown first. If no commodity overlap exists yet, all Tier 1 suppliers are available."
                        : "Matching Tier 2 suppliers are shown first. If no commodity overlap exists yet, all Tier 2 suppliers are available."}
                  </p>
                </div>
              ) : null}

              <div style={styles.field}>
                <label htmlFor="annual_revenue" style={styles.label}>Annual revenue</label>
                <input
                  id="annual_revenue"
                  name="annual_revenue"
                  type="number"
                  min="0"
                  value={formData.annual_revenue}
                  onChange={handleFieldChange}
                  placeholder="e.g. 25000000"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="status" style={styles.label}>Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="Pending">Pending</option>
                  <option value="Active" disabled>Active - use monitoring/refresh</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <p style={styles.hint}>
                  Full evidence onboarding is run for Pending suppliers. Active suppliers move through monitoring and refresh.
                </p>
              </div>

              <div style={styles.field}>
                <label htmlFor="onboarding_date" style={styles.label}>Onboarding date</label>
                <input
                  id="onboarding_date"
                  name="onboarding_date"
                  type="date"
                  value={formData.onboarding_date}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                />
              </div>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Traceability requirements</h2>
                <p style={styles.sectionText}>
                  These fields define what evidence is needed before approval and feed Traceability later.
                </p>
              </div>
              <span style={styles.pillAlt}>{onboardingRequirements.status}</span>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label htmlFor="supplier_role" style={styles.label}>Supplier role</label>
                <select
                  id="supplier_role"
                  name="supplier_role"
                  value={formData.supplier_role}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="Producer">Producer</option>
                  <option value="Aggregator">Aggregator</option>
                  <option value="Processor">Processor</option>
                  <option value="Trader">Trader</option>
                  <option value="Manufacturer">Manufacturer</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="plot_traceability_available" style={styles.label}>Plot traceability available</label>
                <select
                  id="plot_traceability_available"
                  name="plot_traceability_available"
                  value={formData.plot_traceability_available}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="geolocation_evidence_available" style={styles.label}>Geolocation evidence</label>
                <select
                  id="geolocation_evidence_available"
                  name="geolocation_evidence_available"
                  value={formData.geolocation_evidence_available}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="chain_of_custody_available" style={styles.label}>Chain of custody evidence</label>
                <select
                  id="chain_of_custody_available"
                  name="chain_of_custody_available"
                  value={formData.chain_of_custody_available}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="deforestation_declaration_available" style={styles.label}>Deforestation-free declaration</label>
                <select
                  id="deforestation_declaration_available"
                  name="deforestation_declaration_available"
                  value={formData.deforestation_declaration_available}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="labor_questionnaire_status" style={styles.label}>Labor questionnaire</label>
                <select
                  id="labor_questionnaire_status"
                  name="labor_questionnaire_status"
                  value={formData.labor_questionnaire_status}
                  onChange={handleFieldChange}
                  style={styles.textInput}
                >
                  <option value="Not Required">Not Required</option>
                  <option value="Requested">Requested</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="eudr_relevant" style={styles.label}>EUDR relevant</label>
                <select id="eudr_relevant" name="eudr_relevant" value={formData.eudr_relevant} onChange={handleFieldChange} style={styles.textInput}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="traceability_required" style={styles.label}>Traceability required</label>
                <select id="traceability_required" name="traceability_required" value={formData.traceability_required} onChange={handleFieldChange} style={styles.textInput}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            <div style={styles.field}>
              <label htmlFor="traceability_notes" style={styles.label}>Traceability notes</label>
              <textarea
                id="traceability_notes"
                name="traceability_notes"
                value={formData.traceability_notes}
                onChange={handleFieldChange}
                placeholder="Capture known origin regions, plot coverage, evidence gaps, or business comments."
                style={styles.textArea}
              />
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Readiness and extracted context</h2>
                <p style={styles.sectionText}>
                  Confirm the supplier profile after the supply scope and evidence requirements are known.
                </p>
              </div>
            </div>

            <div style={styles.readinessCard}>
              <div style={styles.readinessBarTrack}>
                <div style={{ ...styles.readinessBarFill, width: `${supplierCompletion}%` }} />
              </div>
              <strong style={styles.readinessValue}>{supplierCompletion}% complete</strong>
            </div>

            {missingFields.length > 0 ? (
              <div style={styles.validationBlock}>
                <h3 style={styles.warningTitle}>Still needed before moving on</h3>
                <ul style={styles.list}>
                  {missingFields.map((field) => (
                    <li key={field} style={styles.warningItem}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={styles.success}>Supplier details are complete enough for final review.</p>
            )}

            <div style={styles.previewGrid}>
              <div style={styles.previewCard}>
                <span style={styles.previewLabel}>Extracted commodities</span>
                <strong style={styles.previewValue}>{formData.commodities || "Not extracted yet"}</strong>
              </div>
              <div style={styles.previewCard}>
                <span style={styles.previewLabel}>Extracted certifications</span>
                <strong style={styles.previewValue}>{formData.certifications || "Not extracted yet"}</strong>
              </div>
              {needsLinkedSupplier ? (
                <div style={styles.previewCard}>
                  <span style={styles.previewLabel}>Linked supplier</span>
                  <strong style={styles.previewValue}>{linkedSupplierName || "Not linked yet"}</strong>
                </div>
              ) : null}
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => setActiveTab("mapping")}
                style={styles.secondaryButton}
              >
                Back to Commodities & Certifications
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("review")}
                disabled={missingFields.length > 0}
                className="btn-primary"
              >
                Continue to Review & Submit
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderMappingTab() {
    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>Tab 2</span>
            <h1 style={styles.heroTitle}>Commodity and certification mapping</h1>
            <p style={styles.heroText}>
              Convert extracted text into structured `v2` mappings and add the certification metadata
              needed for onboarding.
            </p>
          </div>
          <div style={styles.metricGrid}>
            <Metric value={selectedCommodityNames.length} label="Commodities selected" />
            <Metric value={selectedCertificationNames.length} label="Certifications selected" />
            <Metric value={averageDeforestationRisk ?? "N/A"} label="Avg deforestation risk" />
          </div>
        </section>

        <section style={styles.stack}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Commodity mapping</h2>
                <p style={styles.sectionText}>
                  These choices come from your existing `commodities_v2` file and drive onboarding risk context.
                </p>
              </div>
              <span style={styles.pill}>{selectedCommodityNames.length} selected</span>
            </div>

            <div style={styles.optionGrid}>
              {COMMODITY_OPTIONS.map((commodity) => {
                const selected = selectedCommodityNames.includes(commodity.name);
                return (
                  <button
                    key={commodity.id}
                    type="button"
                    onClick={() => handleCommodityToggle(commodity.name)}
                    style={{
                      ...styles.optionCard,
                      ...(selected ? styles.optionCardActive : {}),
                    }}
                  >
                    <span style={styles.optionTitle}>{commodity.name}</span>
                    <span style={styles.optionMeta}>Risk: {commodity.riskLevel}</span>
                    <span style={styles.optionMeta}>
                      Deforestation: {commodity.deforestationRiskScore.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Certification mapping</h2>
                <p style={styles.sectionText}>
                  Select supplier certifications, then capture issue date, expiry date, and verification status.
                </p>
              </div>
              <span style={styles.pillAlt}>{selectedCertificationNames.length} mapped</span>
            </div>

            <div style={styles.optionGrid}>
              {CERTIFICATION_OPTIONS.map((name) => {
                const selected = selectedCertificationNames.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleCertificationToggle(name)}
                    style={{
                      ...styles.optionCard,
                      ...(selected ? styles.optionCardActive : {}),
                    }}
                  >
                    <span style={styles.optionTitle}>{name}</span>
                    <span style={styles.optionMeta}>{selected ? "Included" : "Click to add"}</span>
                  </button>
                );
              })}
            </div>

            {certificationRows.length > 0 ? (
              <div style={styles.certRows}>
                {certificationRows.map((row) => {
                  const evidence = evidenceUploads[row.name];
                  const evidenceStatus = evidence?.validation_status || "Missing Evidence";
                  const statusStyle =
                    evidenceStatus === "Verified"
                      ? styles.statusVerified
                      : evidenceStatus === "Expired" || evidenceStatus === "Needs Review"
                        ? styles.statusReview
                        : styles.statusMissing;

                  return (
                    <div key={row.name} style={styles.certEvidenceCard}>
                      <div style={styles.certCardHeader}>
                        <div style={styles.certTitleBlock}>
                          <strong style={styles.certTitle}>{row.name}</strong>
                          <span style={{ ...styles.statusPill, ...statusStyle }}>{evidenceStatus}</span>
                        </div>
                        <label style={styles.uploadSurfaceInline}>
                          <span style={styles.uploadTitleSmall}>
                            {evidenceUploadState[row.name] === "Uploading" ? "Uploading evidence..." : "Select evidence file"}
                          </span>
                          <span style={styles.uploadTextSmall}>
                            {evidence?.file_name || "PDF/image/text evidence. Extraction runs after selection."}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.txt"
                            onChange={(event) => handleEvidenceUpload(row.name, event.target.files?.[0])}
                            style={styles.hiddenInput}
                          />
                        </label>
                      </div>

                      <div style={styles.certFieldGrid}>
                        <div style={styles.field}>
                          <label style={styles.label}>Certificate number</label>
                          <input
                            type="text"
                            value={row.certificate_number || ""}
                            onChange={(event) =>
                              handleCertificationRowChange(row.name, "certificate_number", event.target.value)
                            }
                            placeholder="Auto-extracted after upload"
                            style={styles.textInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Issuing body</label>
                          <input
                            type="text"
                            value={row.issuing_body || ""}
                            onChange={(event) =>
                              handleCertificationRowChange(row.name, "issuing_body", event.target.value)
                            }
                            placeholder="e.g. FLOCERT GmbH"
                            style={styles.textInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Issue date</label>
                          <input
                            type="date"
                            value={row.issue_date}
                            onChange={(event) =>
                              handleCertificationRowChange(row.name, "issue_date", event.target.value)
                            }
                            style={styles.textInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Expiry date</label>
                          <input
                            type="date"
                            value={row.expiry_date}
                            onChange={(event) =>
                              handleCertificationRowChange(row.name, "expiry_date", event.target.value)
                            }
                            style={styles.textInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Review status</label>
                          <select
                            value={row.status}
                            onChange={(event) =>
                              handleCertificationRowChange(row.name, "status", event.target.value)
                            }
                            style={styles.textInput}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Verified">Verified</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </div>
                        <div style={{ ...styles.field, ...styles.certScopeField }}>
                          <label style={styles.label}>Scope / site</label>
                          <input
                            type="text"
                            value={row.scope || ""}
                            onChange={(event) =>
                              handleCertificationRowChange(row.name, "scope", event.target.value)
                            }
                            placeholder="Auto-extracted scope or facility"
                            style={styles.textInput}
                          />
                        </div>
                      </div>

                      {evidence ? (
                        <div style={styles.evidenceStatusCard}>
                          <strong>{evidence.validation_status}</strong>
                          <span>{evidence.validation_notes}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={styles.muted}>No certification rows yet. Select one or more certifications to continue.</p>
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Evidence checklist</h2>
                <p style={styles.sectionText}>
                  Required documents are generated from the selected commodities, certifications, and traceability profile.
                </p>
              </div>
              <span style={styles.pillAlt}>
                {onboardingRequirements.completeRequired}/{onboardingRequirements.totalRequired || 0} required complete
              </span>
            </div>

            <div style={styles.requirementGrid}>
              {onboardingRequirements.requirements.map((item) => {
                const statusStyle =
                  item.status === "Complete"
                    ? styles.statusVerified
                    : item.status === "Missing" || item.status === "Needs Review" || item.status === "Expired"
                      ? styles.statusReview
                      : styles.statusMissing;
                return (
                  <div key={item.id} style={styles.requirementCard}>
                    <div style={styles.requirementTopline}>
                      <span style={styles.requirementType}>{item.type}</span>
                      <span style={{ ...styles.statusPill, ...statusStyle }}>{item.status}</span>
                    </div>
                    <strong style={styles.requirementTitle}>{item.title}</strong>
                    <span style={styles.requirementReason}>{item.reason}</span>
                    {item.canUpload ? (
                      <div style={styles.requirementUploadRow}>
                        <label style={styles.uploadSurfaceInline}>
                          <span style={styles.uploadTitleSmall}>
                            {requirementUploadState[item.id] === "Uploading" ? "Uploading document..." : "Select checklist document"}
                          </span>
                          <span style={styles.uploadTextSmall}>
                            {requirementUploads[item.id]?.file_name || "PDF/image/text evidence. Validation runs after selection."}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.txt"
                            onChange={(event) => handleRequirementUpload(item, event.target.files?.[0])}
                            style={styles.hiddenInput}
                          />
                        </label>
                        {requirementUploads[item.id] ? (
                          <span style={styles.requirementReason}>
                            Evidence ID {requirementUploads[item.id].evidence_id}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>AI-suggested ESG baseline</h2>
                <p style={styles.sectionText}>
                  Scores are generated from supplier country, commodities, certifications, and evidence status.
                  Review and override only when you have stronger evidence.
                </p>
              </div>
              <span style={styles.pillAlt}>
                {baselineSuggestion ? `${String(baselineSuggestion.confidence || "medium").toUpperCase()} confidence` : "Awaiting context"}
              </span>
            </div>

            {baselineSuggestion ? (
              <div style={styles.baselineSummary}>
                <div style={styles.previewCard}>
                  <span style={styles.previewLabel}>Overall baseline</span>
                  <strong style={styles.previewValue}>{baselineSuggestion.overall}/100</strong>
                </div>
                <div style={styles.reasonList}>
                  {(baselineSuggestion.reasons || []).slice(0, 4).map((reason) => (
                    <span key={reason} style={styles.reasonItem}>{reason}</span>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={styles.scoreGrid}>
              {ESG_SCORE_FIELDS.map(([name, label, pillar]) => {
                const score = Number(formData[name] || 0);
                return (
                  <div key={name} style={styles.scoreField}>
                    <div style={styles.scoreHead}>
                      <div>
                        <label htmlFor={name} style={styles.label}>{label}</label>
                        <span style={styles.scorePillar}>{pillar}</span>
                      </div>
                      <strong style={styles.scoreValue}>{score}</strong>
                    </div>
                    <input
                      id={name}
                      name={name}
                      type="range"
                      min="0"
                      max="100"
                      value={formData[name]}
                      onChange={handleFieldChange}
                      style={styles.rangeInput}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Mapping readiness</h2>
              <p style={styles.sectionText}>
                At least one commodity is required. Certifications remain optional but strongly recommended.
              </p>
            </div>
          </div>

          <div style={styles.previewGrid}>
            <div style={styles.previewCard}>
              <span style={styles.previewLabel}>Selected commodities</span>
              <strong style={styles.previewValue}>
                {selectedCommodityNames.join(", ") || "None selected"}
              </strong>
            </div>
            <div style={styles.previewCard}>
              <span style={styles.previewLabel}>Selected certifications</span>
              <strong style={styles.previewValue}>
                {selectedCertificationNames.join(", ") || "None selected"}
              </strong>
            </div>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={() => setActiveTab("document")} style={styles.secondaryButton}>
              Back to Document Upload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("supplier")}
              disabled={selectedCommodityNames.length === 0}
              className="btn-primary"
            >
              Continue to Supplier Details
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderReviewTab() {
    const missingFields = [];
    if (!formData.supplier_name) missingFields.push("Supplier name");
    if (!formData.country) missingFields.push("Country");
    if (!formData.tier) missingFields.push("Tier");
    if (!formData.size) missingFields.push("Size");
    if (!formData.onboarding_date) missingFields.push("Onboarding date");
    if (!formData.status) missingFields.push("Status");
    if (selectedCommodityNames.length === 0) missingFields.push("At least one commodity");
    const displayedDecision = llmDecision || deterministicDecision;

    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>Tab 4</span>
            <h1 style={styles.heroTitle}>Final review and onboarding submission</h1>
            <p style={styles.heroText}>
              Review the supply scope, supplier record, evidence checks, and submission readiness before creating
              the onboarded supplier entry in your current `v2` datasets.
            </p>
          </div>
          <div style={styles.metricGrid}>
            <Metric value={reviewReady ? "Ready" : "Needs review"} label="Submission status" />
            <Metric value={selectedCommodityNames.length} label="Commodity mappings" />
            <Metric value={selectedCertificationNames.length} label="Certification mappings" />
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Supplier summary</h2>
                <p style={styles.sectionText}>
                  Final confirmation of the core onboarding record before submission.
                </p>
              </div>
              <span style={styles.pill}>{reviewReady ? "Ready to submit" : "Action needed"}</span>
            </div>

            <div style={styles.reviewGrid}>
              <ReviewItem label="Supplier name" value={formData.supplier_name || "Missing"} />
              <ReviewItem label="Country" value={formData.country || "Missing"} />
              <ReviewItem label="Tier" value={formData.tier || "Missing"} />
              <ReviewItem
                label="Linked supplier"
                value={needsLinkedSupplier ? linkedSupplierName || "Missing" : "Not required"}
              />
              <ReviewItem label="Size" value={formData.size || "Missing"} />
              <ReviewItem label="Annual revenue" value={formData.annual_revenue || "Not provided"} />
              <ReviewItem label="Status" value={formData.status || "Missing"} />
              <ReviewItem label="Onboarding date" value={formData.onboarding_date || "Missing"} />
              <ReviewItem label="ESG baseline date" value={formData.esg_baseline_date || "Missing"} />
              <ReviewItem label="Evidence status" value={formData.evidence_status || "Missing"} />
              <ReviewItem label="EUDR relevant" value={formData.eudr_relevant || "Missing"} />
              <ReviewItem label="Traceability required" value={formData.traceability_required || "Missing"} />
              <ReviewItem label="Supplier role" value={formData.supplier_role || "Missing"} />
              <ReviewItem
                label="Evidence checklist"
                value={`${onboardingRequirements.completeRequired}/${onboardingRequirements.totalRequired || 0} required complete`}
              />
              <ReviewItem label="Business status" value={formData.approval_status || suggestedApprovalStatus} />
              <ReviewItem label="AI recommendation" value={displayedDecision.recommendation} />
              <ReviewItem label="Site / region" value={formData.site_region || "Not provided"} />
              <ReviewItem
                label="Avg deforestation risk"
                value={averageDeforestationRisk ?? "No commodities selected"}
              />
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Submission readiness</h2>
                <p style={styles.sectionText}>
                  The current backend submission persists supplier name, country, commodities, and certifications.
                </p>
              </div>
            </div>

            {missingFields.length > 0 ? (
              <div style={styles.validationBlock}>
                <h3 style={styles.warningTitle}>Complete these before submitting</h3>
                <ul style={styles.list}>
                  {missingFields.map((field) => (
                    <li key={field} style={styles.warningItem}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={styles.success}>All required onboarding inputs are present.</p>
            )}

            {evidenceGaps.length > 0 ? (
              <div style={styles.validationBlock}>
                <h3 style={styles.warningTitle}>Evidence gaps</h3>
                <ul style={styles.list}>
                  {evidenceGaps.map((field) => (
                    <li key={field} style={styles.warningItem}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={styles.success}>Certification evidence checks are complete.</p>
            )}

            <div style={styles.approvalPanel}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>AI onboarding decision</h2>
                  <p style={styles.sectionText}>
                    AI recommends the onboarding outcome from extracted fields, evidence checks, traceability requirements, and ESG baseline.
                  </p>
                </div>
                <div style={styles.provenanceRail}>
                  <AiProvenanceBadge provenance={displayedDecision} />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        approval_status: displayedDecision.recommendation,
                        approval_blockers:
                          displayedDecision.recommendation === "Ready for Approval"
                            ? ""
                            : current.approval_blockers || displayedDecision.nextActions.join("\n"),
                        approval_conditions:
                          current.approval_conditions || displayedDecision.nextActions.join("\n"),
                      }))
                    }
                    style={styles.secondaryButton}
                  >
                    Apply recommendation
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiDecision(deterministicDecision, evidenceGaps)}
                    style={styles.secondaryButton}
                    disabled={isDecisionLoading}
                  >
                    {isDecisionLoading ? "Asking LLM..." : "Ask LLM"}
                  </button>
                </div>
              </div>

              <div style={styles.decisionBanner}>
                <span style={styles.previewLabel}>AI recommendation</span>
                <strong style={styles.decisionValue}>{displayedDecision.recommendation}</strong>
                <span style={styles.requirementReason}>
                  Confidence: {displayedDecision.confidence}. Source: {displayedDecision.source || "deterministic"}. Business user can confirm or override.
                </span>
              </div>

              <div style={styles.decisionGrid}>
                <div style={styles.decisionList}>
                  <span style={styles.previewLabel}>Why AI recommends this</span>
                  {displayedDecision.reasons.map((reason) => (
                    <span key={reason} style={styles.reasonItem}>{reason}</span>
                  ))}
                </div>
                <div style={styles.decisionList}>
                  <span style={styles.previewLabel}>Next actions</span>
                  {displayedDecision.nextActions.map((action) => (
                    <span key={action} style={styles.reasonItem}>{action}</span>
                  ))}
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label htmlFor="approval_status" style={styles.label}>Business status</label>
                  <select
                    id="approval_status"
                    name="approval_status"
                    value={formData.approval_status}
                    onChange={handleFieldChange}
                    style={styles.textInput}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Evidence Requested">Evidence Requested</option>
                    <option value="Evidence Under Review">Evidence Under Review</option>
                    <option value="Ready for Approval">Ready for Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Approved With Conditions">Approved With Conditions</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label htmlFor="approval_conditions" style={styles.label}>Conditions / next actions</label>
                  <textarea
                    id="approval_conditions"
                    name="approval_conditions"
                    value={formData.approval_conditions}
                    onChange={handleFieldChange}
                    placeholder="Example: request plot evidence, complete questionnaire, or accept supplier with conditions."
                    style={styles.textArea}
                  />
                </div>
                <div style={styles.field}>
                  <label htmlFor="approval_blockers" style={styles.label}>Blockers detected</label>
                  <textarea
                    id="approval_blockers"
                    name="approval_blockers"
                    value={formData.approval_blockers}
                    onChange={handleFieldChange}
                    placeholder="Open evidence gaps, expired documents, missing traceability, or policy blockers."
                    style={styles.textArea}
                  />
                </div>
              </div>
            </div>

            <div style={styles.previewGrid}>
              <div style={styles.previewCard}>
                <span style={styles.previewLabel}>Commodities</span>
                <strong style={styles.previewValue}>
                  {selectedCommodityNames.join(", ") || "None selected"}
                </strong>
              </div>
              <div style={styles.previewCard}>
                <span style={styles.previewLabel}>Certifications</span>
                <strong style={styles.previewValue}>
                  {selectedCertificationNames.join(", ") || "None selected"}
                </strong>
              </div>
              <div style={styles.previewCard}>
                <span style={styles.previewLabel}>ESG baseline sample</span>
                <strong style={styles.previewValue}>
                  Water {formData.water}, Labor {formData.labor}, Compliance {formData.compliance}
                </strong>
              </div>
            </div>

            {submissionMessage ? (
              <p style={styles.success}>
                {submissionMessage}
                {submittedSupplierId ? ` (Supplier ID: ${submittedSupplierId})` : ""}
              </p>
            ) : null}

            {aiAssistance ? (
              <div style={styles.aiAssistCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.sectionTitle}>AI validation guidance</h3>
                    <p style={styles.sectionText}>{aiAssistance.summary}</p>
                  </div>
                  <div style={styles.provenanceRail}>
                    <AiProvenanceBadge provenance={aiAssistance} />
                    <span style={styles.pillAlt}>
                      {String(aiAssistance.confidence || "medium").toUpperCase()} confidence
                    </span>
                  </div>
                </div>

                {Array.isArray(aiAssistance?.actions) && aiAssistance.actions.length > 0 ? (
                  <ul style={styles.list}>
                    {aiAssistance.actions.map((action) => (
                      <li key={action} style={styles.warningItem}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}

            <div style={styles.actions}>
              <button type="button" onClick={() => setActiveTab("supplier")} style={styles.secondaryButton}>
                Back to Supplier Details
              </button>
              <button
                type="button"
                onClick={handleSubmitSupplier}
                disabled={!reviewReady || isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? "Submitting..." : "Submit Onboarding"}
              </button>
              {submittedSupplierId && formData.status === "Pending" ? (
                <button
                  type="button"
                  onClick={handleActivateSupplier}
                  disabled={isActivating || formData.approval_status === "Evidence Requested" || formData.approval_status === "Evidence Under Review"}
                  className="btn-primary"
                >
                  {isActivating ? "Activating..." : "Approve & Activate"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {certificationRows.length > 0 ? (
          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Certification review</h2>
                <p style={styles.sectionText}>
                  Quick review of the certification rows captured in Tab 2.
                </p>
              </div>
            </div>

            <div style={styles.certRows}>
              {certificationRows.map((row) => (
                <div key={row.name} style={styles.certRow}>
                  <div style={styles.certName}>{row.name}</div>
                  <div style={styles.reviewCell}>{row.issue_date || "No issue date"}</div>
                  <div style={styles.reviewCell}>{row.expiry_date || "No expiry date"}</div>
                  <div style={styles.reviewCell}>{row.status}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderRevalidationTab() {
    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>Active Supplier Refresh</span>
            <h1 style={styles.heroTitle}>Revalidate existing active suppliers</h1>
            <p style={styles.heroText}>
              Use this lane for suppliers that are already active. Refresh certifications, traceability, and ESG evidence
              without sending them through new-supplier onboarding again.
            </p>
          </div>
          <div style={styles.metricGrid}>
            <Metric value={activeSupplierOptions.length} label="Active suppliers" />
            <Metric value={selectedRevalidationSupplier?.country || "None"} label="Selected country" />
            <Metric value={revalidationOutcome} label="Refresh outcome" />
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Supplier refresh record</h2>
                <p style={styles.sectionText}>
                  Select an active supplier, choose the revalidation outcome, and store the refresh decision.
                </p>
              </div>
              <span style={styles.pillAlt}>Active only</span>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label htmlFor="revalidation_supplier" style={styles.label}>Active supplier</label>
                <select
                  id="revalidation_supplier"
                  value={revalidationSupplierId}
                  onChange={(event) => setRevalidationSupplierId(event.target.value)}
                  style={styles.textInput}
                >
                  <option value="">Select supplier</option>
                  {activeSupplierOptions.map((supplier) => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name} - {supplier.country}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label htmlFor="revalidation_outcome" style={styles.label}>Revalidation outcome</label>
                <select
                  id="revalidation_outcome"
                  value={revalidationOutcome}
                  onChange={(event) => setRevalidationOutcome(event.target.value)}
                  style={styles.textInput}
                >
                  <option value="Revalidation Requested">Revalidation Requested</option>
                  <option value="Evidence Received">Evidence Received</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Revalidated">Revalidated</option>
                </select>
              </div>
            </div>

            <div style={styles.field}>
              <label htmlFor="revalidation_notes" style={styles.label}>Refresh notes</label>
              <textarea
                id="revalidation_notes"
                value={revalidationNotes}
                onChange={(event) => setRevalidationNotes(event.target.value)}
                placeholder="Summarize certificate expiry checks, traceability refresh, open gaps, or accepted evidence."
                style={styles.textArea}
              />
            </div>

            {revalidationMessage ? <p style={styles.success}>{revalidationMessage}</p> : null}
            {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}

            <div style={styles.actions}>
              <button
                type="button"
                onClick={handleRevalidateSupplier}
                disabled={!revalidationSupplierId || isRevalidating}
                className="btn-primary"
              >
                {isRevalidating ? "Updating..." : "Save Revalidation"}
              </button>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Selected supplier snapshot</h2>
                <p style={styles.sectionText}>
                  This is the supplier refresh context that later feeds ESG Monitoring and Auditing.
                </p>
              </div>
            </div>
            <div style={styles.reviewGrid}>
              <ReviewItem label="Supplier" value={selectedRevalidationSupplier?.supplier_name || "Not selected"} />
              <ReviewItem label="Supplier ID" value={selectedRevalidationSupplier?.supplier_id || "Not selected"} />
              <ReviewItem label="Tier" value={selectedRevalidationSupplier?.tier || "Missing"} />
              <ReviewItem label="Status" value={selectedRevalidationSupplier?.status || "Missing"} />
              <ReviewItem label="Certification" value={selectedRevalidationSupplier?.certification || "Not shown"} />
              <ReviewItem label="Onboarding date" value={selectedRevalidationSupplier?.onboarding_date || "Missing"} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === "document") return renderDocumentTab();
    if (activeTab === "supplier") {
      return renderSupplierTab();
    }
    if (activeTab === "mapping") {
      return renderMappingTab();
    }
    if (activeTab === "revalidation") {
      return renderRevalidationTab();
    }
    return renderReviewTab();
  }

  const shellContent = (
    <div style={embedded ? styles.embeddedContainer : styles.container}>
      {!embedded ? (
        <section style={styles.frame}>
          <div style={styles.heading}>
            <span style={styles.eyebrow}>Supplier Engagement & Onboarding</span>
            <h1 style={styles.pageTitle}>AI-assisted onboarding workbench</h1>
            <p style={styles.pageText}>
              We are building this module tab by tab. Tab 1 is now wired to the existing extraction backend.
            </p>
          </div>

          <div style={styles.tabRail}>
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              const isEnabled = true;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => isEnabled && setActiveTab(tab.id)}
                  style={{
                    ...styles.tab,
                    ...(isActive ? styles.tabActive : {}),
                    ...(!isEnabled ? styles.tabDisabled : {}),
                  }}
                >
                  <span style={styles.tabLabel}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section style={styles.embeddedFrame}>
          <div style={styles.tabRail}>
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...styles.tab,
                    ...(isActive ? styles.tabActive : {}),
                  }}
                >
                  <span style={styles.tabLabel}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section style={styles.flowBanner}>
        <div style={styles.flowBannerItem}>
          <span style={styles.flowBannerLabel}>Current phase</span>
          <strong style={styles.flowBannerValue}>{TABS.find((tab) => tab.id === activeTab)?.label}</strong>
        </div>
        <div style={styles.flowBannerItem}>
          <span style={styles.flowBannerLabel}>Supplier readiness</span>
          <strong style={styles.flowBannerValue}>{supplierCompletion}%</strong>
        </div>
        <div style={styles.flowBannerItem}>
          <span style={styles.flowBannerLabel}>Commodity mappings</span>
          <strong style={styles.flowBannerValue}>{selectedCommodityNames.length}</strong>
        </div>
        <div style={styles.flowBannerItem}>
          <span style={styles.flowBannerLabel}>Workflow lane</span>
          <strong style={styles.flowBannerValue}>{formData.status === "Pending" ? "Pending onboarding" : "Refresh only"}</strong>
        </div>
        <div style={styles.flowBannerItem}>
          <span style={styles.flowBannerLabel}>Submission state</span>
          <strong style={styles.flowBannerValue}>{reviewReady ? "Ready" : "In progress"}</strong>
        </div>
      </section>

      {formData.status !== "Pending" ? (
        <section style={styles.statusNotice}>
          <strong>Supplier is outside the onboarding lane.</strong>
          <span>
            Keep this workflow for Pending suppliers. Existing Active suppliers should be reviewed through ESG Monitoring,
            revalidation, or periodic evidence refresh instead of creating a new onboarding record.
          </span>
        </section>
      ) : null}

      {renderActiveTab()}
    </div>
  );

  if (embedded) {
    return shellContent;
  }

  return <main style={styles.page}>{shellContent}</main>;
}

async function getResponseError(response, fallback) {
  try {
    const payload = await response.json();
    return typeof payload?.detail === "string" ? payload.detail : fallback;
  } catch {
    return fallback;
  }
}

function Metric({ value, label }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div style={styles.summary}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div style={styles.reviewItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px 20px 48px",
    background:
      "radial-gradient(circle at top left, rgba(34, 197, 94, 0.12), transparent 28%), linear-gradient(180deg, #f4f6f3 0%, #eef3ed 100%)",
  },
  container: { maxWidth: "1240px", margin: "0 auto", display: "grid", gap: "22px" },
  embeddedContainer: { display: "grid", gap: "22px" },
  frame: {
    display: "grid",
    gap: "20px",
    padding: "26px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(244,250,245,0.92) 60%, rgba(227,240,229,0.98))",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    boxShadow: "0 16px 40px rgba(17, 22, 18, 0.08)",
    position: "sticky",
    top: "16px",
    zIndex: 2,
    backdropFilter: "blur(10px)",
  },
  embeddedFrame: {
    display: "grid",
    gap: "16px",
    padding: "0",
  },
  heading: { display: "grid", gap: "10px" },
  eyebrow: { fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#166534" },
  pageTitle: { margin: 0, fontSize: "clamp(2rem, 3vw, 3.2rem)", color: "#101913", lineHeight: 1.05 },
  pageText: { margin: 0, maxWidth: "760px", color: "#465542" },
  tabRail: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", alignItems: "center", gap: "8px", width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #dfe7dd", background: "#ffffff", boxShadow: "0 1px 2px rgba(17,22,18,0.04)" },
  tab: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: "38px", padding: "8px 14px", borderRadius: "6px", border: "1px solid transparent", background: "transparent", color: "#40503d", textAlign: "center", cursor: "pointer", transition: "background 0.16s ease, color 0.16s ease, border-color 0.16s ease" },
  tabActive: { background: "#166534", borderColor: "#166534", boxShadow: "none", color: "#fff" },
  tabDisabled: { opacity: 0.55, cursor: "not-allowed" },
  tabLabel: { fontSize: "13px", fontWeight: 800, whiteSpace: "nowrap" },
  flowBanner: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  flowBannerItem: { display: "grid", gap: "4px", padding: "16px 18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,250,246,0.98))", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 8px 20px rgba(17, 22, 18, 0.05)" },
  flowBannerLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#73826f" },
  flowBannerValue: { color: "#152117", fontSize: "1rem" },
  statusNotice: { display: "grid", gap: "6px", padding: "16px 18px", borderRadius: "18px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#7c2d12", fontSize: "14px", lineHeight: 1.5 },
  stack: { display: "grid", gap: "22px" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: "18px", padding: "26px", borderRadius: "28px", background: "linear-gradient(140deg, rgba(12, 25, 17, 0.96), rgba(24, 52, 34, 0.92) 55%, rgba(39, 78, 49, 0.9))", color: "#f5faf5", boxShadow: "0 18px 40px rgba(10, 24, 16, 0.18)" },
  heroCopy: { display: "grid", gap: "12px" },
  heroTitle: { margin: 0, fontSize: "clamp(1.8rem, 2.6vw, 2.8rem)", color: "#f8fff8", lineHeight: 1.08 },
  heroText: { margin: 0, color: "rgba(236, 245, 236, 0.86)" },
  metricGrid: { display: "grid", gap: "12px", alignContent: "start" },
  metric: { display: "grid", gap: "4px", padding: "16px", borderRadius: "18px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.08)" },
  metricValue: { fontSize: "1.7rem", fontWeight: 700, color: "#fff" },
  metricLabel: { color: "rgba(235, 245, 235, 0.76)" },
  panel: { display: "grid", gap: "18px", alignContent: "start", width: "100%", minWidth: 0, padding: "24px 36px 24px 24px", borderRadius: "28px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)" },
  sectionHead: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  provenanceRail: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: "8px" },
  sectionTitle: { margin: 0, fontSize: "1.3rem", color: "#101913" },
  sectionText: { marginTop: "6px", maxWidth: "720px", color: "#566753" },
  pill: { padding: "8px 12px", borderRadius: "999px", background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0", fontSize: "12px", fontWeight: 700 },
  pillAlt: { padding: "8px 12px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: "12px", fontWeight: 700 },
  uploadCard: { display: "grid", gap: "16px", padding: "18px", borderRadius: "22px", background: "linear-gradient(180deg, rgba(241, 246, 241, 0.95), rgba(255,255,255,0.98))", border: "1px solid rgba(17, 22, 18, 0.08)" },
  uploadSurface: { display: "grid", gap: "10px", width: "100%", minWidth: 0, padding: "22px 20px", borderRadius: "8px", border: "1px dashed #76b889", background: "#fbfffc", cursor: "pointer" },
  uploadSurfaceInline: { display: "grid", gap: "6px", width: "min(360px, 100%)", minWidth: "240px", padding: "13px 15px", borderRadius: "8px", border: "1px dashed #76b889", background: "#fbfffc", cursor: "pointer" },
  uploadTitle: { color: "#14532d", fontSize: "16px", fontWeight: 800 },
  uploadTitleSmall: { color: "#14532d", fontSize: "13px", fontWeight: 800 },
  uploadText: { color: "#5f705c", fontSize: "15px", lineHeight: 1.45, wordBreak: "break-word" },
  uploadTextSmall: { color: "#5f705c", fontSize: "12px", lineHeight: 1.4, wordBreak: "break-word" },
  hiddenInput: { display: "none" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" },
  field: { display: "grid", gap: "8px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#1d2a1f" },
  fileInput: { width: "100%", padding: "14px", borderRadius: "16px", border: "1px dashed rgba(17, 22, 18, 0.18)", background: "#fff" },
  textInput: { width: "100%", minHeight: "46px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "14px" },
  textArea: { width: "100%", minHeight: "92px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "14px", resize: "vertical", fontFamily: "inherit" },
  hint: { color: "#6a7a67", fontSize: "13px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  summary: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17, 22, 18, 0.08)" },
  summaryLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  summaryValue: { color: "#101913", wordBreak: "break-word" },
  systemField: { display: "grid", gap: "6px", alignContent: "start", minHeight: "96px", padding: "14px 16px", borderRadius: "16px", background: "#f8fbf8", border: "1px solid rgba(17, 22, 18, 0.08)" },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" },
  secondaryButton: { minHeight: "44px", padding: "0 18px", borderRadius: "12px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontWeight: 600, cursor: "pointer" },
  disabledButton: { opacity: 0.45, cursor: "not-allowed" },
  linkButton: { border: "none", background: "transparent", color: "#166534", fontWeight: 700, cursor: "pointer", padding: 0 },
  error: { color: "#dc2626", fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "22px", alignItems: "start" },
  previewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  previewCard: { display: "grid", gap: "6px", padding: "16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  previewLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#758571" },
  previewValue: { color: "#152117", fontSize: "1rem", lineHeight: 1.35, wordBreak: "break-word" },
  baselineSummary: { display: "grid", gridTemplateColumns: "minmax(160px, 220px) 1fr", gap: "14px", alignItems: "stretch" },
  reasonList: { display: "grid", gap: "8px", alignContent: "start" },
  reasonItem: { display: "block", padding: "10px 12px", borderRadius: "14px", background: "#f8fbf8", border: "1px solid rgba(17, 22, 18, 0.08)", color: "#435447", fontSize: "13px", lineHeight: 1.45 },
  requirementGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  requirementCard: { display: "grid", gap: "10px", padding: "16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f8fbf8)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  requirementTopline: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  requirementType: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#758571", fontWeight: 800 },
  requirementTitle: { color: "#152117", lineHeight: 1.35 },
  requirementReason: { color: "#586856", fontSize: "13px", lineHeight: 1.45 },
  requirementUploadRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", paddingTop: "4px" },
  approvalPanel: { display: "grid", gap: "16px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, #ffffff, #f8fbf8)", border: "1px solid rgba(17, 22, 18, 0.1)" },
  decisionBanner: { display: "grid", gap: "6px", padding: "16px", borderRadius: "18px", background: "#f8fbf8", border: "1px solid rgba(17, 22, 18, 0.08)" },
  decisionValue: { color: "#152117", fontSize: "1.35rem", lineHeight: 1.2 },
  decisionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" },
  decisionList: { display: "grid", gap: "8px", alignContent: "start" },
  scoreGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  scoreField: { display: "grid", gap: "10px", padding: "14px", borderRadius: "16px", background: "#ffffff", border: "1px solid rgba(17, 22, 18, 0.08)" },
  scoreHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  scorePillar: { display: "block", marginTop: "3px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#758571" },
  scoreValue: { fontSize: "1.15rem", color: "#142018" },
  rangeInput: { width: "100%", accentColor: "#166534" },
  reviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  reviewItem: { display: "grid", gap: "6px", padding: "16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  optionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", width: "100%", minWidth: 0 },
  optionCard: { display: "grid", gap: "6px", width: "100%", minWidth: 0, padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17, 22, 18, 0.1)", background: "#fff", textAlign: "left", cursor: "pointer", transition: "background 0.16s ease, border-color 0.16s ease" },
  optionCardActive: { background: "linear-gradient(180deg, #ecfdf3, #f7fff9)", borderColor: "#22c55e" },
  optionTitle: { fontWeight: 700, color: "#152117" },
  optionMeta: { color: "#5f6f5c", fontSize: "13px" },
  certRows: { display: "grid", gap: "16px", width: "100%", minWidth: 0 },
  certRow: { display: "grid", gridTemplateColumns: "minmax(180px, 1.2fr) repeat(3, minmax(160px, 1fr))", gap: "12px", alignItems: "center", width: "100%", minWidth: 0, padding: "14px 16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  certEvidenceCard: { display: "grid", gap: "16px", width: "100%", minWidth: 0, padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, #ffffff, #f8fbf8)", border: "1px solid rgba(17, 22, 18, 0.1)", boxShadow: "0 8px 20px rgba(17, 22, 18, 0.04)" },
  certCardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" },
  certTitleBlock: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 },
  certTitle: { color: "#152117", fontSize: "1.05rem" },
  certFieldGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px", width: "100%", minWidth: 0 },
  certScopeField: { minWidth: 0 },
  certName: { fontWeight: 700, color: "#152117" },
  statusPill: { display: "inline-flex", alignItems: "center", minHeight: "28px", padding: "0 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  statusVerified: { background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0" },
  statusReview: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" },
  statusMissing: { background: "#f4f6f4", color: "#5f6f5c", border: "1px solid rgba(17, 22, 18, 0.1)" },
  uploadButton: { minHeight: "42px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 16px", borderRadius: "12px", border: "1px solid rgba(22, 101, 52, 0.22)", background: "#ecfdf3", color: "#166534", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  evidenceStatusCard: { display: "grid", gap: "4px", padding: "12px 14px", borderRadius: "14px", background: "rgba(22, 101, 52, 0.05)", border: "1px solid rgba(22, 101, 52, 0.12)", color: "#41503f", fontSize: "13px" },
  reviewCell: { color: "#41503f", padding: "10px 12px", borderRadius: "12px", background: "rgba(17, 22, 18, 0.04)" },
  validationBlock: { display: "grid", gap: "10px" },
  aiAssistCard: { display: "grid", gap: "14px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, #f7faf7, #eef8f1)", border: "1px solid rgba(34, 197, 94, 0.18)" },
  muted: { color: "#637260" },
  list: { margin: 0, paddingLeft: "18px", display: "grid", gap: "6px" },
  errorTitle: { margin: 0, color: "#b91c1c", fontSize: "1rem" },
  warningTitle: { margin: 0, color: "#b45309", fontSize: "1rem" },
  errorItem: { color: "#dc2626" },
  warningItem: { color: "#d97706" },
  success: { color: "#166534", fontWeight: 700 },
  readinessCard: { display: "grid", gap: "10px", padding: "16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  readinessBarTrack: { width: "100%", height: "10px", borderRadius: "999px", background: "rgba(17, 22, 18, 0.08)", overflow: "hidden" },
  readinessBarFill: { height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, #22c55e, #166534)" },
  readinessValue: { color: "#152117", fontSize: "0.95rem" },
  rawBlock: { display: "grid", gap: "10px", marginTop: "8px" },
  pre: { margin: 0, padding: "16px", borderRadius: "16px", background: "#0f172a", color: "#e2e8f0", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6, maxHeight: "320px" },
  placeholder: { display: "grid", gap: "12px", padding: "32px", borderRadius: "28px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)" },
  placeholderTitle: { margin: 0, fontSize: "1.8rem", color: "#101913" },
  placeholderText: { margin: 0, maxWidth: "760px", color: "#566753" },
};
