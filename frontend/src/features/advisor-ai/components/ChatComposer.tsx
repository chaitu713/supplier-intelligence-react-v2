import { useState } from "react";

interface ChatComposerProps {
  isLoading: boolean;
  initialValue?: string;
  variant?: "page" | "overlay";
  onSubmit: (message: string) => Promise<void> | void;
}

export function ChatComposer({
  isLoading,
  initialValue = "",
  variant = "page",
  onSubmit,
}: ChatComposerProps) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    await onSubmit(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={
        variant === "overlay"
          ? "flex flex-col gap-3"
          : "surface-card flex flex-col gap-4 p-4"
      }
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={variant === "overlay" ? 3 : 4}
        placeholder="Ask about your supplier network..."
        className={
          variant === "overlay"
            ? "textarea-field rounded-[1.25rem] text-sm leading-6 text-[var(--text-secondary)] shadow-sm"
            : "textarea-field rounded-[1.5rem] text-sm leading-6 text-[var(--text-secondary)]"
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {variant === "page" ? (
          <p className="text-xs text-slate-500">
            Keep questions detailed here for better supplier-specific responses.
          </p>
        ) : (
          <p className="text-[11px] text-[var(--muted)]">
            Tip: include supplier name, country, and timeframe.
          </p>
        )}
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className={
            variant === "overlay"
              ? "btn-primary inline-flex items-center justify-center gap-2 px-4 text-sm"
              : "btn-primary px-5 text-sm"
          }
        >
          {isLoading ? "Analyzing..." : "Send"}
        </button>
      </div>
    </form>
  );
}
