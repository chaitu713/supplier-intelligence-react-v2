interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  accentClassName: string;
}

export function KpiCard({
  label,
  value,
  subtitle,
  accentClassName,
}: KpiCardProps) {
  const tone = getTone(label, accentClassName);

  return (
    <div
      className="visual-card interactive-card relative flex min-h-[142px] flex-col overflow-hidden p-4"
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,0.99) 0%, ${tone.wash} 100%)`,
      }}
    >
      <div className="flex h-8 items-start justify-between gap-4">
        <div
          className="grid h-7 w-7 place-items-center rounded-lg border"
          style={{
            borderColor: tone.border,
            background: tone.iconBg,
            color: tone.color,
          }}
          aria-hidden="true"
        >
          <MetricIcon kind={tone.icon} />
        </div>
      </div>
      <p className="mt-4 min-h-[34px] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none tracking-tight text-[var(--text)]">
        {value}
      </p>
    </div>
  );
}

function getTone(label: string, accentClassName: string): {
  icon: MetricIconKind;
  color: string;
  border: string;
  iconBg: string;
  wash: string;
  line: string;
} {
  const normalized = label.toLowerCase();

  if (normalized.includes("high risk")) {
    return {
      icon: "alert",
      color: "#b45309",
      border: "rgba(245, 158, 11, 0.28)",
      iconBg: "rgba(255, 251, 235, 0.88)",
      wash: "rgba(245, 158, 11, 0.08)",
      line: "#f59e0b",
    };
  }

  if (normalized.includes("cert")) {
    return {
      icon: "certificate",
      color: "#6d28d9",
      border: "rgba(124, 58, 237, 0.22)",
      iconBg: "rgba(245, 243, 255, 0.9)",
      wash: "rgba(124, 58, 237, 0.07)",
      line: "#8b5cf6",
    };
  }

  if (normalized.includes("operational")) {
    return {
      icon: "activity",
      color: "#0e7490",
      border: "rgba(6, 182, 212, 0.24)",
      iconBg: "rgba(236, 254, 255, 0.9)",
      wash: "rgba(6, 182, 212, 0.07)",
      line: "#06b6d4",
    };
  }

  if (normalized.includes("esg")) {
    return {
      icon: "leaf",
      color: "#0f766e",
      border: "rgba(15, 118, 110, 0.24)",
      iconBg: "rgba(240, 253, 250, 0.9)",
      wash: "rgba(15, 118, 110, 0.07)",
      line: "#0f766e",
    };
  }

  if (normalized.includes("risk")) {
    return {
      icon: "gauge",
      color: "#0369a1",
      border: "rgba(14, 165, 233, 0.24)",
      iconBg: "rgba(240, 249, 255, 0.9)",
      wash: "rgba(14, 165, 233, 0.07)",
      line: "#0ea5e9",
    };
  }

  return {
    icon: "network",
    color: "#166534",
    border: "rgba(22, 101, 52, 0.22)",
    iconBg: "rgba(240, 253, 244, 0.9)",
    wash: "rgba(22, 101, 52, 0.065)",
    line: accentClassName.includes("amber") ? "#f59e0b" : "#166534",
  };
}

type MetricIconKind = "activity" | "alert" | "certificate" | "gauge" | "leaf" | "network";

function MetricIcon({
  kind,
}: {
  kind: MetricIconKind;
}) {
  const className = "h-4 w-4";

  if (kind === "alert") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.5 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }

  if (kind === "certificate") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-3 2-3-2-4 2V6a2 2 0 0 1 2-2Z" />
        <path d="M8.5 9h7" />
        <path d="M8.5 13h5" />
      </svg>
    );
  }

  if (kind === "activity") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M4 13h4l2-6 4 10 2-4h4" />
      </svg>
    );
  }

  if (kind === "leaf") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M19 4c-6.3.4-10.8 3-13.2 7.2-1.2 2-1.8 4.2-1.7 6.8 2.5.1 4.8-.4 6.8-1.6C15 13.9 17.6 9.3 18 3Z" />
        <path d="M8 16c1.6-2.5 4-4.8 7.2-6.9" />
      </svg>
    );
  }

  if (kind === "gauge") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M4 14a8 8 0 1 1 16 0" />
        <path d="M12 14l4-4" />
        <path d="M6 18h12" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M7 7h10v10H7z" />
      <path d="M4 12h3" />
      <path d="M17 12h3" />
      <path d="M12 4v3" />
      <path d="M12 17v3" />
    </svg>
  );
}
