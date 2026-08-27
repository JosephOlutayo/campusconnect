import type { ReactNode } from "react";

import { formatFullDate } from "@/lib/time";

type Props = {
  title: string;
  eyebrow?: string;
  /** Prints today's date above the title, like the reference dashboard. */
  showDate?: boolean;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ title, eyebrow, showDate, subtitle, actions, children }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {showDate ? (
          <p className="mb-1 text-[13px] font-medium text-ink-muted">{formatFullDate(new Date())}</p>
        ) : eyebrow ? (
          <p className="mb-1 text-[11px] font-bold tracking-[0.09em] text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink sm:text-[2.125rem]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
