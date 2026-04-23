import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { FloatingChatButton } from "../common/FloatingChatButton";
import { AdvisorChatOverlay } from "../../features/advisor-ai/components/AdvisorChatOverlay";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: "/supplier-engagement", label: "Supplier Engagement" },
  { to: "/overview-dashboard", label: "Overview Dashboard" },
  { to: "/risk-monitoring", label: "Risk Monitoring" },
  { to: "/due-diligence", label: "Due Diligence" },
];

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
                SI
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-[-0.025em] text-[var(--text)]">
                Supplier Intelligence AI
              </div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">
                Operations Workspace
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/supplier-engagement"}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link-active" : ""}`.trim()
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden lg:flex">
            <div className="surface-soft flex items-center gap-3 px-4 py-2">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Workspace
                </div>
                <div className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                  Consistent supplier, risk, and AI views
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-wrap pb-3 pt-2 md:hidden">
          <nav className="flex items-center gap-4 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/supplier-engagement"}
                className={({ isActive }) =>
                  `nav-link whitespace-nowrap ${isActive ? "nav-link-active" : ""}`.trim()
                }
              >
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
