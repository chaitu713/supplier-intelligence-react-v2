import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../../api/client";
import type { DocumentKind } from "../../../api/documents";
import { ProcessingSummaryCardRef } from "../components/ProcessingSummaryCardRef";
import { ProcessingTimeline } from "../components/ProcessingTimeline";
import { UploadCard } from "../components/UploadCard";
import { UploadDropzone } from "../components/UploadDropzone";
import {
  useIngestionJob,
  useStartDocumentIngestion,
} from "../hooks/useDocumentIngestion";

type FileState = Record<DocumentKind, File | null>;

const initialFiles: FileState = {
  supplier: null,
  esg: null,
  transaction: null,
};

const uploadDefinitions: Array<{
  kind: DocumentKind;
  title: string;
  description: string;
  icon: string;
  tintClassName: string;
  emptyLabel: string;
}> = [
  {
    kind: "supplier",
    title: "Supplier Document",
    description: "Company and supplier master data",
    icon: "🏭",
    tintClassName: "bg-[var(--accent-soft)] text-[var(--accent)]",
    emptyLabel: "Upload supplier PDF",
  },
  {
    kind: "esg",
    title: "ESG Document",
    description: "Environmental and social metrics",
    icon: "🌿",
    tintClassName: "bg-emerald-50 text-emerald-700",
    emptyLabel: "Upload ESG PDF",
  },
  {
    kind: "transaction",
    title: "Transaction Document",
    description: "Order and transaction records",
    icon: "💳",
    tintClassName: "bg-amber-50 text-amber-700",
    emptyLabel: "Upload transaction PDF",
  },
];

export function DocumentIngestionPage() {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileState>(initialFiles);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const startIngestionMutation = useStartDocumentIngestion();
  const ingestionJobQuery = useIngestionJob(activeJobId);

  const isReadyToProcess = useMemo(
    () => Boolean(files.supplier && files.esg && files.transaction),
    [files],
  );

  const currentJob = ingestionJobQuery.data ?? startIngestionMutation.data;

  const handleFileChange = (kind: DocumentKind, file: File | null) => {
    setFiles((current) => ({
      ...current,
      [kind]: file,
    }));
  };

  const handleProcessDocuments = async () => {
    if (!files.supplier || !files.esg || !files.transaction) {
      return;
    }

    const job = await startIngestionMutation.mutateAsync({
      supplierFile: files.supplier,
      esgFile: files.esg,
      transactionFile: files.transaction,
    });

    setActiveJobId(job.jobId);
  };

  const errorMessage = getErrorMessage(
    startIngestionMutation.error ?? ingestionJobQuery.error,
  );

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header px-8 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow text-sm">
                Document Ingestion
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                Upload and process supplier, ESG, and transaction PDFs
              </h1>
              <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                This React flow replaces the Streamlit ingestion page with a cleaner
                production-ready UI. It registers uploads, sends files to object storage,
                triggers ingestion, and tracks processing history through backend APIs.
              </p>
            </div>
            <div className="surface-soft px-5 py-4">
              <p className="muted-eyebrow">
                Upload Status
              </p>
              <p className="mono mt-2 text-2xl font-semibold text-[var(--text)]">
                {Object.values(files).filter(Boolean).length}/3
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Documents selected</p>
            </div>
          </div>
        </header>

        <section className="surface-card grid gap-4 p-6 md:grid-cols-5">
          {[
            { title: "Upload", subtitle: "Select PDF files" },
            { title: "Store", subtitle: "Upload to blob storage" },
            { title: "Extract", subtitle: "Run document intelligence" },
            { title: "Process", subtitle: "Parse structured records" },
            { title: "History", subtitle: "Log ingestion results" },
          ].map((step, index) => (
            <div key={step.title} className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{step.title}</p>
                <p className="text-xs text-[var(--muted)]">{step.subtitle}</p>
              </div>
            </div>
          ))}
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-3">
          {uploadDefinitions.map((definition) => (
            <UploadCard
              key={definition.kind}
              icon={definition.icon}
              title={definition.title}
              description={definition.description}
              tintClassName={definition.tintClassName}
            >
              <UploadDropzone
                label={definition.emptyLabel}
                file={files[definition.kind]}
                onFileSelect={(file) => handleFileChange(definition.kind, file)}
              />
            </UploadCard>
          ))}
        </section>

        <section className="surface-card sticky bottom-4 z-10 p-5 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="muted-eyebrow">
                Pipeline Control
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--text)]">
                {isReadyToProcess
                  ? "All required files are attached and ready for processing."
                  : "Attach supplier, ESG, and transaction PDFs to continue."}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                The existing upload and ingestion behavior is unchanged.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleProcessDocuments()}
              disabled={!isReadyToProcess || startIngestionMutation.isPending}
              className="btn-primary px-6 py-3"
            >
              {startIngestionMutation.isPending ? "Processing..." : "Process Documents"}
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
          <ProcessingTimeline
            job={currentJob}
            isLoading={startIngestionMutation.isPending && !currentJob}
          />

          {currentJob?.status === "completed" ? (
            <ProcessingSummaryCardRef job={currentJob} />
          ) : (
            <aside className="surface-card p-6">
              <h3 className="text-lg font-semibold text-[var(--text)]">Ready State</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                All three documents must be selected before the pipeline can start.
              </p>

              <div className="mt-5 space-y-3">
                {uploadDefinitions.map((definition) => {
                  const selected = Boolean(files[definition.kind]);

                  return (
                    <div
                      key={definition.kind}
                      className="surface-subtle flex items-center justify-between px-4 py-3"
                    >
                      <span className="text-sm font-medium text-[var(--text-secondary)]">
                        {definition.title}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          selected
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {selected ? "Selected" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while processing documents.";
}
