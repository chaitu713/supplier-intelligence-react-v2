const suggestions = [
  "Which suppliers have the highest risk scores?",
  "Which countries have the most high-risk suppliers?",
  "Recommend low-risk suppliers for sourcing",
];

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
  variant?: "stack" | "chips";
}

export function PromptSuggestions({
  onSelect,
  variant = "stack",
}: PromptSuggestionsProps) {
  if (variant === "chips") {
    return (
      <div className="flex flex-wrap gap-2">
        {suggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full border bg-white px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--primary-muted)] hover:text-[var(--primary)]"
            style={{ borderColor: "var(--border)" }}
          >
            {prompt}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="surface-subtle px-4 py-4 text-left text-sm font-medium text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--primary)]"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
