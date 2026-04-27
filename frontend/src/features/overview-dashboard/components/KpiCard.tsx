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
  return (
    <div className="visual-card p-6">
      <div className={`h-1.5 w-14 rounded-full ${accentClassName}`} />
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
    </div>
  );
}
