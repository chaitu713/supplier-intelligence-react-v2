import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../../../api/client";
import { ChatComposer } from "./ChatComposer";
import { ChatMessage } from "./ChatMessage";
import { PromptSuggestions } from "./PromptSuggestions";
import {
  useAdvisorSession,
  useCreateAdvisorSession,
  useSendAdvisorMessage,
} from "../hooks/useAdvisorAI";

interface AdvisorChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdvisorChatOverlay({ isOpen, onClose }: AdvisorChatOverlayProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const createSessionMutation = useCreateAdvisorSession();
  const sessionQuery = useAdvisorSession(isOpen ? sessionId : null);
  const sendMessageMutation = useSendAdvisorMessage(isOpen ? sessionId : null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!sessionId && !createSessionMutation.isPending && !createSessionMutation.data) {
      createSessionMutation.mutate(undefined, {
        onSuccess: (session) => setSessionId(session.sessionId),
      });
    }
  }, [createSessionMutation, isOpen, sessionId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const messages = useMemo(() => sessionQuery.data?.messages ?? [], [sessionQuery.data]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isOpen, messages.length, sendMessageMutation.isPending]);

  const handleSend = async (message: string) => {
    if (!sessionId) {
      return;
    }

    await sendMessageMutation.mutateAsync(message);
  };

  const errorMessage = getErrorMessage(
    createSessionMutation.error ?? sessionQuery.error ?? sendMessageMutation.error,
  );

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed bottom-6 right-6 z-50 flex w-[min(460px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[32px] border shadow-2xl"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--primary-soft) 55%, white), white 38%)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Supplier Advisor AI"
      >
        <header
          className="flex items-center justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 place-items-center rounded-2xl border shadow-sm"
                style={{
                  borderColor: "var(--primary-muted)",
                  background: "var(--primary)",
                  color: "white",
                }}
              >
                <span className="text-xs font-semibold">AI</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">
                  Supplier Advisor
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {sessionId ? "Session active" : "Starting session..."}
                  {sendMessageMutation.isPending ? " • Generating" : ""}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-[var(--text-secondary)] hover:bg-slate-50"
            style={{ borderColor: "var(--border)" }}
            aria-label="Close chat"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {errorMessage ? (
          <div className="border-b bg-rose-50 px-5 py-3 text-xs text-rose-700" style={{ borderColor: "var(--border)" }}>
            {errorMessage}
          </div>
        ) : null}

        <div className="flex h-[min(62vh,560px)] flex-col">
          <div className="flex-1 overflow-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div
                  className="rounded-3xl border px-4 py-4 text-sm text-[var(--text-secondary)] shadow-sm"
                  style={{
                    borderColor: "var(--border)",
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(240,253,244,0.65))",
                  }}
                >
                  Ask about supplier risk, ESG, delays, concentration risk, or safer
                  alternatives. I’ll reference your latest dashboard context where possible.
                </div>
                <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: "var(--border)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Suggested prompts
                  </div>
                  <div className="mt-3">
                    <PromptSuggestions
                      variant="chips"
                      onSelect={(prompt) => void handleSend(prompt)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={`${message.role}-${message.createdAt}-${index}`}
                    message={message}
                    />
                  ))}
                <div ref={scrollAnchorRef} />
              </div>
            )}
          </div>

          <div
            className="border-t px-5 py-4"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--surface) 78%, transparent)",
              backdropFilter: "blur(10px)",
            }}
          >
            <ChatComposer
              isLoading={
                createSessionMutation.isPending ||
                sessionQuery.isLoading ||
                sendMessageMutation.isPending
              }
              onSubmit={handleSend}
              variant="overlay"
            />
          </div>
        </div>
      </aside>
    </>
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
