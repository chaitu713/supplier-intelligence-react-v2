import type { AdvisorLens } from "../../../api/advisor";

const suggestionsByLens: Record<AdvisorLens, string[]> = {
  general: [
    "Why are high-risk suppliers increasing?",
    "Which suppliers should go to due diligence first?",
    "Which countries are driving the most supplier risk?",
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
    "Which supplier needs the strongest follow-up action?",
    "What is the top risk driver for the highest-risk supplier?",
  ],
  esg_monitoring: [
    "Which suppliers are driving ESG pressure?",
    "Which ESG pillar looks weakest right now?",
    "What should the ESG monitoring team investigate first?",
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
