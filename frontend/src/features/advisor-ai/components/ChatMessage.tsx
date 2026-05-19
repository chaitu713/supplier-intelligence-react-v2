import type { AdvisorMessage } from "../../../api/advisor";
import { AiProvenanceBadge } from "../../../components/common/AiProvenanceBadge";
import { StructuredContent } from "../../../components/common/StructuredContent";
import { formatDateTime } from "../../../utils/formatting";

interface ChatMessageProps {
  message: AdvisorMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser ? (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold shadow-sm"
          style={{
            borderColor: "var(--primary-muted)",
            background: "linear-gradient(135deg, var(--primary-soft), white)",
            color: "var(--primary)",
          }}
        >
          AI
        </div>
      ) : null}
      <div
        className={`max-w-[32rem] rounded-[1.75rem] px-5 py-4 text-sm ${
          isUser
            ? "bg-[var(--primary)] text-white shadow-[0_2px_12px_rgba(22,101,52,0.18)]"
            : "border border-[color:var(--border)] bg-white text-[var(--text-secondary)] shadow-sm"
        }`}
        style={
          !isUser
            ? {
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,252,248,0.95) 100%)",
              }
            : {
                background:
                  "linear-gradient(135deg, #1a7a3e 0%, #166534 100%)",
              }
        }
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isUser ? "text-white/60" : "text-slate-500"
              }`}
            >
              {isUser ? "Your Question" : "Supplier Advisor AI"}
            </p>
            {!isUser ? <AiProvenanceBadge provenance={message} compact /> : null}
          </div>
          <p className={`text-xs ${isUser ? "text-white/50" : "text-slate-400"}`}>
            {formatDateTime(message.createdAt)}
          </p>
        </div>
        {isUser ? (
          <div className="whitespace-pre-wrap leading-7">{message.content}</div>
        ) : (
          <div className="prose prose-slate max-w-none text-[14px] leading-7">
            <StructuredContent content={message.content} />
          </div>
        )}
      </div>
      {isUser ? (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold shadow-sm"
          style={{
            borderColor: "var(--border)",
            background: "linear-gradient(135deg, var(--surface-2), white)",
            color: "var(--primary)",
          }}
        >
          You
        </div>
      ) : null}
    </div>
  );
}
