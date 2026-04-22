import { useState } from "react";

export default function OnboardingPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [formData, setFormData] = useState({
    supplier_name: "",
    country: "",
    commodities: "",
    certifications: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submittedSupplierId, setSubmittedSupplierId] = useState(null);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleUpload() {
    if (!selectedFile) {
      setErrorMessage("Please select a file before uploading.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setSubmissionMessage("");
    setSubmittedSupplierId(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://localhost:8000/onboarding/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload and extract document.");
      }

      const payload = await response.json();
      setExtractedData(payload);
      setValidationData(payload?.validation ?? { errors: [], warnings: [] });
      setFormData({
        supplier_name: payload?.supplier_name ?? "",
        country: payload?.country ?? "",
        commodities: Array.isArray(payload?.commodities) ? payload.commodities.join(", ") : "",
        certifications: Array.isArray(payload?.certifications)
          ? payload.certifications.join(", ")
          : "",
      });
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

      if (selectedFile) {
        payload.append("file", selectedFile);
      }

      payload.append("supplier_name", formData.supplier_name);
      payload.append("country", formData.country);
      payload.append(
        "commodities",
        JSON.stringify(
          formData.commodities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      );
      payload.append(
        "certifications",
        JSON.stringify(
          formData.certifications
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      );

      const response = await fetch("http://localhost:8000/onboarding/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error("Failed to submit supplier.");
      }

      const result = await response.json();
      setSubmissionMessage(result?.message ?? "Supplier onboarded successfully");
      setSubmittedSupplierId(result?.supplier_id ?? null);

      setFormData({
        supplier_name: "",
        country: "",
        commodities: "",
        certifications: "",
      });
      setSelectedFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit supplier.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>AI-Assisted Supplier Onboarding</h1>
          <p style={styles.subtitle}>
            Upload a supplier document to extract and preview onboarding data.
          </p>
        </header>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Section 1: File Upload</h2>
          <div style={styles.uploadRow}>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              style={styles.input}
            />
            <button type="button" onClick={handleUpload} disabled={isUploading} style={styles.button}>
              {isUploading ? "Uploading..." : "Upload & Extract"}
            </button>
          </div>
          {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Section 2: Extracted Data</h2>
          {extractedData ? (
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label htmlFor="supplier_name" style={styles.label}>
                  Supplier Name
                </label>
                <input
                  id="supplier_name"
                  name="supplier_name"
                  type="text"
                  value={formData.supplier_name}
                  onChange={handleFormChange}
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="country" style={styles.label}>
                  Country
                </label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  value={formData.country}
                  onChange={handleFormChange}
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="commodities" style={styles.label}>
                  Commodities
                </label>
                <input
                  id="commodities"
                  name="commodities"
                  type="text"
                  value={formData.commodities}
                  onChange={handleFormChange}
                  placeholder="Palm Oil, Cocoa"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="certifications" style={styles.label}>
                  Certifications
                </label>
                <input
                  id="certifications"
                  name="certifications"
                  type="text"
                  value={formData.certifications}
                  onChange={handleFormChange}
                  style={styles.textInput}
                />
              </div>
            </div>
          ) : (
            <pre style={styles.pre}>No extracted data yet.</pre>
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Section 3: Validation</h2>
          {!validationData ? <p style={styles.mutedText}>No validation data yet.</p> : null}

          {validationData?.errors?.length > 0 ? (
            <div style={styles.validationGroup}>
              <h3 style={styles.errorHeading}>Errors</h3>
              <ul style={styles.list}>
                {validationData.errors.map((error) => (
                  <li key={error} style={styles.errorText}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {validationData?.warnings?.length > 0 ? (
            <div style={styles.validationGroup}>
              <h3 style={styles.warningHeading}>Warnings</h3>
              <ul style={styles.list}>
                {validationData.warnings.map((warning) => (
                  <li key={warning} style={styles.warningText}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {validationData &&
          (validationData.errors?.length ?? 0) === 0 &&
          (validationData.warnings?.length ?? 0) === 0 ? (
            <p style={styles.successText}>All checks passed</p>
          ) : null}

          <div style={styles.submitRow}>
            <button
              type="button"
              onClick={handleSubmitSupplier}
              disabled={!validationData?.is_valid || isSubmitting}
              style={{
                ...styles.button,
                ...( !validationData?.is_valid || isSubmitting ? styles.buttonDisabled : {}),
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit Supplier"}
            </button>
          </div>

          {submissionMessage ? (
            <p style={styles.successText}>
              {submissionMessage}
              {submittedSupplierId ? ` (Supplier ID: ${submittedSupplierId})` : ""}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    padding: "32px 20px",
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    display: "grid",
    gap: "20px",
  },
  header: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "32px",
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
  section: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
  },
  sectionTitle: {
    margin: "0 0 16px",
    fontSize: "20px",
    color: "#0f172a",
  },
  uploadRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
  },
  input: {
    flex: "1 1 280px",
  },
  button: {
    border: "none",
    borderRadius: "10px",
    padding: "12px 18px",
    backgroundColor: "#166534",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    cursor: "not-allowed",
  },
  error: {
    marginTop: "12px",
    color: "#b91c1c",
  },
  mutedText: {
    margin: 0,
    color: "#475569",
  },
  formGrid: {
    display: "grid",
    gap: "16px",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#0f172a",
  },
  textInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px",
    color: "#0f172a",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
  },
  validationGroup: {
    display: "grid",
    gap: "10px",
    marginBottom: "16px",
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
  },
  errorHeading: {
    margin: 0,
    color: "#b91c1c",
  },
  warningHeading: {
    margin: 0,
    color: "#d97706",
  },
  errorText: {
    color: "#dc2626",
  },
  warningText: {
    color: "#ea580c",
  },
  successText: {
    margin: 0,
    color: "#15803d",
    fontWeight: 600,
  },
  submitRow: {
    marginTop: "20px",
    display: "flex",
  },
  pre: {
    margin: 0,
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
  },
};
