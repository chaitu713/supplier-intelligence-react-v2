import type { AdvisorLens } from "../../../api/advisor";

const suggestionsByLens: Record<AdvisorLens, string[]> = {
  general: [
    "Give me a Supplier 360 summary for the highest-risk supplier.",
    "Which suppliers should go to due diligence first and why?",
    "What actions should the sourcing team prioritize this week?",
  ],
  executive: [
    "Summarize the current network risk posture.",
    "What should leadership pay attention to right now?",
    "Where is supplier concentration creating the most pressure?",
  ],
  analytics: [
    "Which country is driving the highest average supplier risk?",
    "Which commodity creates the biggest concentration risk?",
    "Explain the main difference between operational and ESG pressure.",
  ],
  simulator: [
    "Explain the latest simulator result.",
    "Why did the high-risk supplier count change?",
    "Which suppliers were impacted most and why?",
  ],
  due_diligence: [
    "Which suppliers should move to due diligence first?",
    "Summarize open audit, certification, and traceability blockers.",
    "What decision and next actions would you recommend for the riskiest supplier?",
  ],
  esg_monitoring: [
    "Which suppliers are driving ESG pressure?",
    "Which ESG pillar looks weakest right now?",
    "What should the future continuous monitoring team investigate first?",
  ],
};

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
  variant?: "stack" | "chips";
  lens?: AdvisorLens;
}

export function PromptSuggestions({
  onSelect,
  variant = "stack",
  lens = "general",
}: PromptSuggestionsProps) {
  const suggestions = suggestionsByLens[lens];

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
