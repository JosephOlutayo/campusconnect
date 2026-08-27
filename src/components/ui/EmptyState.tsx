import type { ReactNode } from "react";

export function EmptyState({
  icon = "✨",
  title,
  description,
  action,
  compact = false,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-surface-muted text-center ${
        compact ? "px-5 py-8" : "px-6 py-14"
      }`}
    >
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface text-2xl shadow-[var(--shadow-soft)]">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-ink sm:text-[1.375rem]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
