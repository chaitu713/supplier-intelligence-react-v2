import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import {
  getAiReviewQueue,
  resolveAiReviewItem,
  type AiReviewItem,
} from "../api/aiReview";

export function AiReviewQueuePage() {
  const [items, setItems] = useState<AiReviewItem[]>([]);
  const [status, setStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function loadQueue(selectedStatus = status) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await getAiReviewQueue(selectedStatus);
      setItems(response);
    } catch (error) {
      setItems([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load AI review queue.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue(status);
  }, [status]);

  async function handleResolve(itemId: string, decision: "approved" | "rejected") {
    setActionMessage("");
    setErrorMessage("");
    try {
      await resolveAiReviewItem(itemId, decision);
      setActionMessage(`Review item ${decision}.`);
      await loadQueue(status);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update review item.");
    }
  }

  return (
    <div style={styles.stack}>
      <section style={styles.header}>
        <div>
          <span style={styles.eyebrow}>AI Governance</span>
          <h2 style={styles.title}>AI review queue</h2>
          <p style={styles.description}>
            Review low-confidence AI outputs from onboarding and auditing before they are treated as workflow guidance.
          </p>
        </div>
        <div style={styles.controls}>
          {["pending", "all"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              style={{
                ...styles.filterButton,
                ...(status === option ? styles.filterButtonActive : {}),
              }}
            >
              {option === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>
      </section>

      {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}
      {actionMessage ? <p style={styles.success}>{actionMessage}</p> : null}
      {isLoading ? <p style={styles.muted}>Loading AI review queue...</p> : null}

      <section style={styles.panel}>
        {items.length === 0 && !isLoading ? (
          <div style={styles.emptyState}>
            <strong>No review items</strong>
            <span>Low-confidence AI outputs will appear here when generated.</span>
          </div>
        ) : (
          <div style={styles.table}>
            <div style={{ ...styles.row, ...styles.rowHeader }}>
              <span>Feature</span>
              <span>Reason</span>
              <span>Created</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {items.map((item) => (
              <div key={item.id} style={styles.row}>
                <div style={styles.primaryCell}>
                  <strong>{formatFeature(item.feature)}</strong>
                  <span>Hash {item.prompt_hash || "not available"}</span>
                </div>
                <div style={styles.primaryCell}>
                  <strong>{formatReason(item.reason)}</strong>
                  <span>{formatPayload(item.payload)}</span>
                </div>
                <span>{formatDate(item.created_at)}</span>
                <span style={styles.statusBadge}>{item.status}</span>
                <div style={styles.actionGroup}>
                  {item.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        style={styles.approveButton}
                        onClick={() => void handleResolve(item.id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        style={styles.rejectButton}
                        onClick={() => void handleResolve(item.id, "rejected")}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span style={styles.muted}>Reviewed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatFeature(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReason(value: string) {
  return value.replace(/_/g, " ");
}

function formatPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined && value !== null);
  if (!entries.length) return "No payload details";
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : String(value)}`)
    .join(" | ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const styles: Record<string, CSSProperties> = {
  stack: { display: "grid", gap: "18px" },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#166534",
  },
  title: { margin: "4px 0 0", color: "#101913", fontSize: "1.35rem" },
  description: { margin: "6px 0 0", color: "#5b6c58", maxWidth: "760px" },
  controls: { display: "flex", gap: "8px", flexWrap: "wrap" },
  filterButton: {
    border: "1px solid rgba(17, 22, 18, 0.12)",
    background: "#fff",
    color: "#415240",
    borderRadius: "999px",
    padding: "8px 13px",
    cursor: "pointer",
    fontWeight: 700,
  },
  filterButtonActive: {
    background: "#ecfdf3",
    color: "#166534",
    borderColor: "#86efac",
  },
  panel: {
    display: "grid",
    gap: "12px",
    padding: "20px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    boxShadow: "0 10px 28px rgba(17, 22, 18, 0.06)",
  },
  table: { display: "grid", gap: "10px" },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 1fr) minmax(220px, 1.4fr) minmax(150px, 0.9fr) minmax(90px, 0.5fr) minmax(170px, 0.8fr)",
    gap: "14px",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(17, 22, 18, 0.08)",
    background: "#fff",
  },
  rowHeader: {
    background: "transparent",
    border: "none",
    color: "#73826f",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  primaryCell: { display: "grid", gap: "4px", color: "#1b261d" },
  statusBadge: {
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 700,
  },
  actionGroup: { display: "flex", gap: "8px", flexWrap: "wrap" },
  approveButton: {
    border: "1px solid #86efac",
    background: "#ecfdf3",
    color: "#166534",
    borderRadius: "999px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
  rejectButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "999px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
  emptyState: {
    display: "grid",
    gap: "6px",
    padding: "22px",
    borderRadius: "18px",
    background: "#f8faf8",
    color: "#4d5e4c",
  },
  error: { margin: 0, color: "#b91c1c", fontWeight: 700 },
  success: { margin: 0, color: "#166534", fontWeight: 700 },
  muted: { color: "#6b7a67", fontSize: "13px" },
};
