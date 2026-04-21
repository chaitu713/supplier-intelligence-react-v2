import { useId, type CSSProperties } from "react";
import { formatFileSize } from "../../../utils/formatting";

interface UploadDropzoneProps {
  label: string;
  file: File | null;
  accept?: string;
  onFileSelect: (file: File | null) => void;
}

export function UploadDropzone({
  label,
  file,
  accept = ".pdf,application/pdf",
  onFileSelect,
}: UploadDropzoneProps) {
  const inputId = useId();

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className="group flex min-h-44 cursor-pointer flex-col justify-between rounded-[1.75rem] border px-5 py-5 text-left transition hover:shadow-sm"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, color-mix(in srgb, var(--primary-soft) 35%, white) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1"
            style={{ "--tw-ring-color": "var(--border)" } as CSSProperties}
          >
            <span className="text-lg">PDF</span>
          </div>
          <span className="tag tag-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
            {file ? "Selected" : "Required"}
          </span>
        </div>

        <div className="space-y-2">
          <span className="block text-base font-semibold text-[var(--text)]">
            {file ? file.name : label}
          </span>
          <span className="block text-sm leading-6 text-[var(--muted)]">
            Drag and drop a PDF here, or use browse to attach the file.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {file ? (
            <>
              <span className="tag tag-primary px-3 py-1 text-xs font-semibold">
                {formatFileSize(file.size)}
              </span>
              <span className="tag tag-neutral bg-white px-3 py-1 text-xs font-medium">
                {file.type || "application/pdf"}
              </span>
            </>
          ) : (
            <span className="tag tag-neutral bg-white px-3 py-1 text-xs font-medium">
              Click to browse
            </span>
          )}
        </div>
      </label>

      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
      />

      {file ? (
        <button
          type="button"
          onClick={() => onFileSelect(null)}
          className="inline-flex items-center rounded-full px-1 text-xs font-semibold transition"
          style={{ color: "var(--error)" }}
        >
          Remove file
        </button>
      ) : null}
    </div>
  );
}
