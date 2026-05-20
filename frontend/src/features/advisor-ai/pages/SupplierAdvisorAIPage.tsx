import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import type { AdvisorLens, AdvisorSimulatorContext } from "../../../api/advisor";
import { ApiError } from "../../../api/client";
import { AdvisorCompassIcon } from "../../../components/common/FloatingChatButton";
import { ChatComposer } from "../components/ChatComposer";
import { ChatMessage } from "../components/ChatMessage";
import { PromptSuggestions } from "../components/PromptSuggestions";
import {
  useAdvisorSession,
  useCreateAdvisorSession,
  useSendAdvisorMessage,
} from "../hooks/useAdvisorAI";

export function SupplierAdvisorAIPage() {
  const location = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lens] = useState<AdvisorLens>(
    (location.state as AdvisorLocationState | null)?.lens ?? "general",
  );
  const [simulatorContext, setSimulatorContext] = useState<AdvisorSimulatorContext | null>(
    (location.state as AdvisorLocationState | null)?.simulatorContext ?? null,
  );
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(
    (location.state as AdvisorLocationState | null)?.initialPrompt ?? null,
  );
  const [draftMessage, setDraftMessage] = useState(
    (location.state as AdvisorLocationState | null)?.initialPrompt ?? "",
  );
  const initialPromptAppliedRef = useRef(false);

  const createSessionMutation = useCreateAdvisorSession();
  const sessionQuery = useAdvisorSession(sessionId);
  const sendMessageMutation = useSendAdvisorMessage(sessionId);

  useEffect(() => {
    if (!sessionId && !createSessionMutation.isPending && !createSessionMutation.data) {
      createSessionMutation.mutate(undefined, {
        onSuccess: (session) => setSessionId(session.sessionId),
      });
    }
  }, [createSessionMutation, sessionId]);

  const messages = useMemo(() => sessionQuery.data?.messages ?? [], [sessionQuery.data]);

  const handleSend = async (message: string) => {
    if (!sessionId) {
      return;
    }

    await sendMessageMutation.mutateAsync({
      message,
      lens,
      simulatorContext: lens === "simulator" ? simulatorContext : null,
    });
  };

  const errorMessage = getErrorMessage(
    createSessionMutation.error ?? sessionQuery.error ?? sendMessageMutation.error,
  );
  const effectiveLens = useMemo(
    () => (location.state as AdvisorLocationState | null)?.lens ?? lens,
    [lens, location.state],
  );

  useEffect(() => {
    if (
      !sessionId ||
      !pendingPrompt ||
      initialPromptAppliedRef.current ||
      createSessionMutation.isPending ||
      sendMessageMutation.isPending
    ) {
      return;
    }

    initialPromptAppliedRef.current = true;
    setDraftMessage(pendingPrompt);
    setPendingPrompt(null);
  }, [
    createSessionMutation.isPending,
    pendingPrompt,
    sendMessageMutation.isPending,
    sessionId,
  ]);

  return (
    <div className="page-shell">
      <div className="flex w-full flex-col gap-8">
        <header className="page-header px-8 py-8">
          <p className="eyebrow text-sm">
            Supplier Advisor AI
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            AI-powered guidance across supplier risk, ESG, and performance
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            Ask with the right lens so the advisor can explain executive posture, analytics findings,
            simulator outcomes, due diligence priorities, audit blockers, certification gaps, and
            traceability signals using the live Supplier 360 risk frame.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="tag tag-primary px-3 py-1 text-xs font-semibold">
              {sessionId ? "Session active" : "Initializing session"}
            </span>
            <span className="tag tag-accent px-3 py-1 text-xs font-medium">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
            <span className="tag tag-neutral px-3 py-1 text-xs font-medium">
              {lensLabelMap[lens]} Lens
            </span>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.4fr]">
          <aside className="surface-card p-6">
            <p className="muted-eyebrow">
              Suggested Prompts
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
              Ask targeted sourcing questions
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              These prompts adapt to the page context you arrived from, so the advisor stays focused on the current workflow.
            </p>

            <div className="mt-5">
              <PromptSuggestions
                lens={effectiveLens}
                onSelect={(prompt) => setDraftMessage(prompt)}
              />
            </div>

            <div className="surface-soft mt-6 p-4">
              <p className="muted-eyebrow">
                Best Use
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {lensDescriptionMap[effectiveLens]}
              </p>
            </div>

            {simulatorContext && effectiveLens === "simulator" ? (
              <div className="surface-soft mt-4 p-4">
                <p className="muted-eyebrow">Simulator Context</p>
                <h3 className="mt-2 text-sm font-semibold text-[var(--text)]">
                  {simulatorContext.scenarioTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {simulatorContext.scenarioSummary}
                </p>
              </div>
            ) : null}

            <div className="surface-soft mt-4 p-4">
              <p className="muted-eyebrow">Supplier 360 Context</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                The advisor can now ground answers in supplier risk, audit status, certification
                health, traceability gaps, and due diligence case decisions where those records exist.
              </p>
            </div>
          </aside>

          <div className="space-y-5">
            <section className="surface-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="muted-eyebrow">
                    Conversation
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
                    Supplier analysis workspace
                  </h2>
                </div>
                <span className="tag tag-primary px-3 py-1 text-xs font-medium">
                  {sendMessageMutation.isPending ? "Generating reply" : "Live"}
                </span>
              </div>

              {messages.length === 0 ? (
                <div className="empty-state mt-6 px-6 py-14 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary)] text-2xl text-white shadow-lg">
                    <AdvisorCompassIcon className="h-8 w-8" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[var(--text)]">
                    Supplier Advisor AI Ready
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
                    Ask anything about supplier risk, audit blockers, traceability gaps, ESG pressure,
                    due diligence decisions, or operational insights.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={`${message.role}-${message.createdAt}-${index}`}
                      message={message}
                    />
                  ))}
                </div>
              )}
            </section>

            <ChatComposer
              value={draftMessage}
              isLoading={
                createSessionMutation.isPending ||
                sessionQuery.isLoading ||
                sendMessageMutation.isPending
              }
              submitLabel="Analyze"
              onChange={setDraftMessage}
              onSubmit={handleSend}
            />
          </div>
        </section>
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

  return "Something went wrong while loading the advisor experience.";
}

const lensLabelMap: Record<AdvisorLens, string> = {
  general: "General",
  executive: "Executive",
  analytics: "Analytics",
  simulator: "Simulator",
  due_diligence: "Due Diligence",
  esg_monitoring: "ESG Monitoring",
};

const lensDescriptionMap: Record<AdvisorLens, string> = {
  general: "Best for broad Supplier 360 questions across risk, audits, certifications, traceability gaps, ESG concerns, and sourcing priorities.",
  executive: "Best for concise leadership-ready summaries of network posture, high-risk exposure, and immediate priorities.",
  analytics: "Best for asking why risk is clustered, which drivers matter most, and how countries or commodities compare.",
  simulator: "Best for explaining what changed in a scenario, which suppliers were affected most, and why the deltas moved.",
  due_diligence: "Best for determining which suppliers deserve follow-up review, what their blockers are, and what decision/actions make sense.",
  esg_monitoring: "Best for future continuous monitoring questions around ESG pillar pressure, deterioration patterns, and suppliers that may need follow-up.",
};

interface AdvisorLocationState {
  lens?: AdvisorLens;
  initialPrompt?: string;
  simulatorContext?: AdvisorSimulatorContext | null;
}
