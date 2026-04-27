import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { FloatingChatButton } from "../common/FloatingChatButton";
import { AdvisorChatOverlay } from "../../features/advisor-ai/components/AdvisorChatOverlay";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: "/executive-dashboard", label: "Executive Dashboard", icon: "gauge" },
  { to: "/simulator", label: "Simulator", icon: "simulator" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/supplier-engagement", label: "Supplier Engagement", icon: "engagement" },
  { to: "/due-diligence-agent", label: "Due Diligence Agent", icon: "shield" },
] as const;

export function AppShell({ children }: AppShellProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header
        className="sticky top-0 z-40 w-full border-b"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          backdropFilter: "blur(16px) saturate(1.6)",
          WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        }}
      >
        <div className="page-wrap flex h-[var(--nav-h)] items-center gap-8">
          <div className="flex shrink-0 items-center gap-3">
            <div
              className="grid h-[34px] w-[34px] place-items-center rounded-[10px] border"
              style={{
                background: "var(--primary-soft)",
                borderColor: "var(--primary-muted)",
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                EZ
              </span>
            </div>
            <div className="leading-tight">
              <div className="flex items-start gap-2 text-sm font-bold tracking-[-0.025em] text-[var(--text)]">
                <span>
                  TCS ENVIROZONE
                  <sup className="ml-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">
                    AI
                  </sup>
                </span>
                <span className="pt-[1px] text-[11px] font-semibold tracking-[0.06em] text-[var(--text-secondary)]">
                  4.0
                </span>
              </div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">
                <div>Responsible Sourcing</div>
                <div>&amp; Supplier Intelligence</div>
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `nav-link flex items-center gap-2 ${isActive ? "nav-link-active" : ""}`.trim()
                }
              >
                <NavIcon kind={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

        </div>

        <div className="page-wrap pb-3 pt-2 md:hidden">
          <nav className="flex items-center gap-4 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `nav-link flex items-center gap-2 whitespace-nowrap ${isActive ? "nav-link-active" : ""}`.trim()
                }
              >
                <NavIcon kind={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="page-shell">
        <div className="page-wrap page-content">{children}</div>
      </main>

      <FloatingChatButton
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen((prev) => !prev)}
      />
      <AdvisorChatOverlay isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}

function NavIcon({
  kind,
}: {
  kind: "gauge" | "simulator" | "analytics" | "engagement" | "shield";
}) {
  const className = "h-4 w-4 shrink-0";

  if (kind === "gauge") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 14a8 8 0 1 1 16 0" />
        <path d="M12 14l4-4" />
        <path d="M6 18h12" />
      </svg>
    );
  }

  if (kind === "simulator") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M10 3h4" />
        <path d="M9 3h6" />
        <path d="M10 3v5l-5 8a4 4 0 0 0 3.4 6h7.2A4 4 0 0 0 19 16l-5-8V3" />
        <path d="M8 14h8" />
      </svg>
    );
  }

  if (kind === "analytics") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20v-12" />
      </svg>
    );
  }

  if (kind === "engagement") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M8 12l3 3 5-5" />
        <path d="M3 12c2-4 4-6 7-6 2.2 0 3.7 1.1 5 3 1.3-1.9 2.8-3 5-3 3 0 5 2 7 6-2 4-4 6-7 6-2.2 0-3.7-1.1-5-3-1.3 1.9-2.8 3-5 3-3 0-5-2-7-6Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3Z" />
      <path d="M9.5 12l1.7 1.7L14.8 10" />
    </svg>
  );
}
