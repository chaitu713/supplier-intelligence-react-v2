import { useState } from "react";

const TABS = [
  { id: "document", step: "01", label: "Document Upload" },
  { id: "supplier", step: "02", label: "Supplier Details" },
  { id: "mapping", step: "03", label: "Commodities & Certifications" },
  { id: "review", step: "04", label: "Review & Submit" },
];

const COMMODITY_OPTIONS = [
  { id: 1, name: "Palm Oil", riskLevel: "High", deforestationRiskScore: 0.8033 },
  { id: 2, name: "Cocoa", riskLevel: "High", deforestationRiskScore: 0.6137 },
  { id: 3, name: "Coffee", riskLevel: "Medium", deforestationRiskScore: 0.3972 },
  { id: 4, name: "Rubber", riskLevel: "Medium", deforestationRiskScore: 0.8694 },
  { id: 5, name: "Wood", riskLevel: "Medium", deforestationRiskScore: 0.3357 },
  { id: 6, name: "Soya", riskLevel: "High", deforestationRiskScore: 0.8319 },
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

const emptyForm = {
  supplier_name: "",
  country: "",
  commodities: "",
  certifications: "",
  tier: "Tier 2",
  size: "Medium",
  annual_revenue: "",
  onboarding_date: new Date().toISOString().slice(0, 10),
  status: "Active",
};

export default function OnboardingPage({ embedded = false } = {}) {
  const [activeTab, setActiveTab] = useState("document");
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submittedSupplierId, setSubmittedSupplierId] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
  const [certificationRows, setCertificationRows] = useState([]);
  const [aiAssistance, setAiAssistance] = useState(null);

  const supplierRequiredFields = [
    ["Supplier name", formData.supplier_name],
    ["Country", formData.country],
    ["Tier", formData.tier],
    ["Size", formData.size],
    ["Onboarding date", formData.onboarding_date],
    ["Status", formData.status],
  ];

  const supplierCompletionCount = supplierRequiredFields.filter(([, value]) => Boolean(value)).length;
  const supplierCompletion = Math.round(
    (supplierCompletionCount / supplierRequiredFields.length) * 100,
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
  const selectedCertificationNames = formData.certifications
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedCommodities = COMMODITY_OPTIONS.filter((item) =>
    selectedCommodityNames.includes(item.name),
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
        throw new Error("Failed to upload and extract document.");
      }

      const result = await response.json();
      setExtractedData(result);
      setValidationData(result?.validation ?? { is_valid: false, errors: [], warnings: [] });
      setAiAssistance(result?.ai_assistance ?? null);
      setFormData({
        ...emptyForm,
        supplier_name: result?.supplier_name ?? "",
        country: result?.country ?? "",
        commodities: Array.isArray(result?.commodities) ? result.commodities.join(", ") : "",
        certifications: Array.isArray(result?.certifications)
          ? result.certifications.join(", ")
          : "",
      });
      setCertificationRows(
        (Array.isArray(result?.certifications) ? result.certifications : []).map((name) => ({
          name,
          issue_date: "",
          expiry_date: "",
          status: "Pending",
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
      const payload = new FormData();
      payload.append("supplier_name", formData.supplier_name);
      payload.append("country", formData.country);
      payload.append("tier", formData.tier);
      payload.append("size", formData.size);
      payload.append("annual_revenue", formData.annual_revenue);
      payload.append("onboarding_date", formData.onboarding_date);
      payload.append("status", formData.status);
      payload.append("commodities", JSON.stringify(selectedCommodityNames));
      payload.append("certifications", JSON.stringify(selectedCertificationNames));
      payload.append("certification_rows", JSON.stringify(certificationRows));

      const response = await fetch("http://localhost:8000/onboarding/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error("Failed to submit supplier onboarding.");
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

  function handleUseExtractedData() {
    if (extractedData) {
      setActiveTab("supplier");
    }
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleCommodityToggle(name) {
    const nextValues = selectedCommodityNames.includes(name)
      ? selectedCommodityNames.filter((item) => item !== name)
      : [...selectedCommodityNames, name];

    setFormData((current) => ({
      ...current,
      commodities: nextValues.join(", "),
    }));
  }

  function handleCertificationToggle(name) {
    const exists = selectedCertificationNames.includes(name);
    const nextValues = exists
      ? selectedCertificationNames.filter((item) => item !== name)
      : [...selectedCertificationNames, name];

    setFormData((current) => ({
      ...current,
      certifications: nextValues.join(", "),
    }));

    setCertificationRows((current) => {
      if (exists) {
        return current.filter((row) => row.name !== name);
      }
      return [...current, { name, issue_date: "", expiry_date: "", status: "Pending" }];
    });
  }

  function handleCertificationRowChange(name, field, value) {
    setCertificationRows((current) =>
      current.map((row) => (row.name === name ? { ...row, [field]: value } : row)),
    );
  }

  function handleClear() {
    setSelectedFile(null);
    setExtractedData(null);
    setValidationData(null);
    setFormData(emptyForm);
    setErrorMessage("");
    setShowRawText(false);
    setAiAssistance(null);
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
            <label htmlFor="supplier-upload" style={styles.label}>Supplier document</label>
            <input
              id="supplier-upload"
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              style={styles.fileInput}
            />
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
                  <span style={styles.pillAlt}>
                    {String(aiAssistance.confidence || "medium").toUpperCase()} confidence
                  </span>
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

    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>Tab 2</span>
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
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
                <h2 style={styles.sectionTitle}>Readiness and extracted context</h2>
                <p style={styles.sectionText}>
                  Keep the supplier record tight before moving into commodity and certification mapping.
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
              <p style={styles.success}>Supplier details are complete enough for the next tab.</p>
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
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => setActiveTab("document")}
                style={styles.secondaryButton}
              >
                Back to Document Upload
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mapping")}
                disabled={missingFields.length > 0}
                className="btn-primary"
              >
                Continue to Commodities & Certifications
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
            <span style={styles.eyebrow}>Tab 3</span>
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
                {certificationRows.map((row) => (
                  <div key={row.name} style={styles.certRow}>
                    <div style={styles.certName}>{row.name}</div>
                    <input
                      type="date"
                      value={row.issue_date}
                      onChange={(event) =>
                        handleCertificationRowChange(row.name, "issue_date", event.target.value)
                      }
                      style={styles.textInput}
                    />
                    <input
                      type="date"
                      value={row.expiry_date}
                      onChange={(event) =>
                        handleCertificationRowChange(row.name, "expiry_date", event.target.value)
                      }
                      style={styles.textInput}
                    />
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
                ))}
              </div>
            ) : (
              <p style={styles.muted}>No certification rows yet. Select one or more certifications to continue.</p>
            )}
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
            <button type="button" onClick={() => setActiveTab("supplier")} style={styles.secondaryButton}>
              Back to Supplier Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("review")}
              disabled={selectedCommodityNames.length === 0}
              className="btn-primary"
            >
              Continue to Review & Submit
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

    return (
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>Tab 4</span>
            <h1 style={styles.heroTitle}>Final review and onboarding submission</h1>
            <p style={styles.heroText}>
              Review the supplier record, mapping choices, and submission readiness before creating
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
              <ReviewItem label="Size" value={formData.size || "Missing"} />
              <ReviewItem label="Annual revenue" value={formData.annual_revenue || "Not provided"} />
              <ReviewItem label="Status" value={formData.status || "Missing"} />
              <ReviewItem label="Onboarding date" value={formData.onboarding_date || "Missing"} />
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
                  <span style={styles.pillAlt}>
                    {String(aiAssistance.confidence || "medium").toUpperCase()} confidence
                  </span>
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
              <button type="button" onClick={() => setActiveTab("mapping")} style={styles.secondaryButton}>
                Back to Mapping
              </button>
              <button
                type="button"
                onClick={handleSubmitSupplier}
                disabled={!reviewReady || isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? "Submitting..." : "Submit Onboarding"}
              </button>
            </div>
          </div>
        </section>

        {certificationRows.length > 0 ? (
          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Certification review</h2>
                <p style={styles.sectionText}>
                  Quick review of the certification rows captured in Tab 3.
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

  function renderActiveTab() {
    if (activeTab === "document") return renderDocumentTab();
    if (activeTab === "supplier") {
      return renderSupplierTab();
    }
    if (activeTab === "mapping") {
      return renderMappingTab();
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
                  <span style={styles.tabStep}>{tab.step}</span>
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
                  <span style={styles.tabStep}>{tab.step}</span>
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
          <span style={styles.flowBannerLabel}>Submission state</span>
          <strong style={styles.flowBannerValue}>{reviewReady ? "Ready" : "In progress"}</strong>
        </div>
      </section>

      {renderActiveTab()}
    </div>
  );

  if (embedded) {
    return shellContent;
  }

  return <main style={styles.page}>{shellContent}</main>;
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
  tabRail: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  tab: { display: "grid", gap: "6px", padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17, 22, 18, 0.1)", background: "rgba(255,255,255,0.8)", textAlign: "left", cursor: "pointer", transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease" },
  tabActive: { background: "linear-gradient(135deg, #166534, #14532d)", borderColor: "#166534", boxShadow: "0 14px 28px rgba(22, 101, 52, 0.2)", color: "#fff" },
  tabDisabled: { opacity: 0.55, cursor: "not-allowed" },
  tabStep: { fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" },
  tabLabel: { fontSize: "15px", fontWeight: 600 },
  flowBanner: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  flowBannerItem: { display: "grid", gap: "4px", padding: "16px 18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,250,246,0.98))", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 8px 20px rgba(17, 22, 18, 0.05)" },
  flowBannerLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#73826f" },
  flowBannerValue: { color: "#152117", fontSize: "1rem" },
  stack: { display: "grid", gap: "22px" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: "18px", padding: "26px", borderRadius: "28px", background: "linear-gradient(140deg, rgba(12, 25, 17, 0.96), rgba(24, 52, 34, 0.92) 55%, rgba(39, 78, 49, 0.9))", color: "#f5faf5", boxShadow: "0 18px 40px rgba(10, 24, 16, 0.18)" },
  heroCopy: { display: "grid", gap: "12px" },
  heroTitle: { margin: 0, fontSize: "clamp(1.8rem, 2.6vw, 2.8rem)", color: "#f8fff8", lineHeight: 1.08 },
  heroText: { margin: 0, color: "rgba(236, 245, 236, 0.86)" },
  metricGrid: { display: "grid", gap: "12px", alignContent: "start" },
  metric: { display: "grid", gap: "4px", padding: "16px", borderRadius: "18px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.08)" },
  metricValue: { fontSize: "1.7rem", fontWeight: 700, color: "#fff" },
  metricLabel: { color: "rgba(235, 245, 235, 0.76)" },
  panel: { display: "grid", gap: "18px", width: "100%", minWidth: 0, padding: "24px 36px 24px 24px", borderRadius: "28px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(17, 22, 18, 0.08)", boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)" },
  sectionHead: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  sectionTitle: { margin: 0, fontSize: "1.3rem", color: "#101913" },
  sectionText: { marginTop: "6px", maxWidth: "720px", color: "#566753" },
  pill: { padding: "8px 12px", borderRadius: "999px", background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0", fontSize: "12px", fontWeight: 700 },
  pillAlt: { padding: "8px 12px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: "12px", fontWeight: 700 },
  uploadCard: { display: "grid", gap: "16px", padding: "18px", borderRadius: "22px", background: "linear-gradient(180deg, rgba(241, 246, 241, 0.95), rgba(255,255,255,0.98))", border: "1px solid rgba(17, 22, 18, 0.08)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" },
  field: { display: "grid", gap: "8px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#1d2a1f" },
  fileInput: { width: "100%", padding: "14px", borderRadius: "16px", border: "1px dashed rgba(17, 22, 18, 0.18)", background: "#fff" },
  textInput: { width: "100%", minHeight: "46px", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontSize: "14px" },
  hint: { color: "#6a7a67", fontSize: "13px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  summary: { display: "grid", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "#fff", border: "1px solid rgba(17, 22, 18, 0.08)" },
  summaryLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#71816d" },
  summaryValue: { color: "#101913", wordBreak: "break-word" },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" },
  secondaryButton: { minHeight: "44px", padding: "0 18px", borderRadius: "12px", border: "1px solid rgba(17, 22, 18, 0.14)", background: "#fff", color: "#152117", fontWeight: 600, cursor: "pointer" },
  disabledButton: { opacity: 0.45, cursor: "not-allowed" },
  linkButton: { border: "none", background: "transparent", color: "#166534", fontWeight: 700, cursor: "pointer", padding: 0 },
  error: { color: "#dc2626", fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "22px" },
  previewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  previewCard: { display: "grid", gap: "6px", padding: "16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  previewLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#758571" },
  previewValue: { color: "#152117", fontSize: "1rem", lineHeight: 1.35, wordBreak: "break-word" },
  reviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  reviewItem: { display: "grid", gap: "6px", padding: "16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  optionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", width: "100%", minWidth: 0 },
  optionCard: { display: "grid", gap: "6px", width: "100%", minWidth: 0, padding: "16px 18px", borderRadius: "18px", border: "1px solid rgba(17, 22, 18, 0.1)", background: "#fff", textAlign: "left", cursor: "pointer", transition: "background 0.16s ease, border-color 0.16s ease" },
  optionCardActive: { background: "linear-gradient(180deg, #ecfdf3, #f7fff9)", borderColor: "#22c55e" },
  optionTitle: { fontWeight: 700, color: "#152117" },
  optionMeta: { color: "#5f6f5c", fontSize: "13px" },
  certRows: { display: "grid", gap: "12px", width: "100%", minWidth: 0 },
  certRow: { display: "grid", gridTemplateColumns: "minmax(180px, 1.2fr) repeat(3, minmax(160px, 1fr))", gap: "12px", alignItems: "center", width: "100%", minWidth: 0, padding: "14px 16px", borderRadius: "18px", background: "linear-gradient(180deg, #ffffff, #f7faf7)", border: "1px solid rgba(17, 22, 18, 0.08)" },
  certName: { fontWeight: 700, color: "#152117" },
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
