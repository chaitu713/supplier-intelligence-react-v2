import type { ReactNode } from "react";

interface UploadCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  tintClassName: string;
  children: ReactNode;
}

export function UploadCard({
  icon,
  title,
  description,
  tintClassName,
  children,
}: UploadCardProps) {
  return (
    <section className="surface-card p-5">
      <div className="mb-5 flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg shadow-sm ${tintClassName}`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
