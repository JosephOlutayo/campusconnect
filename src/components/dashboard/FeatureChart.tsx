import type { ReactNode } from "react";

export type Bar = { label: string; value: number; highlight?: boolean };

type Props = {
  headline: string;
  caption: string;
  delta?: { value: string; positive: boolean };
  bars: Bar[];
  footer?: ReactNode;
};

/**
 * The near-black hero card. One per screen, carrying the single number that
 * matters plus a small bar series — the visual anchor the rest of the page is
 * deliberately quiet around.
 */
export function FeatureChart({ headline, caption, delta, bars, footer }: Props) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-feature p-5 text-white sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle,#7c7cf0,transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/60">{caption}</p>
          {delta ? (
            <span
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                delta.positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
              }`}
            >
              {delta.positive ? "▲" : "▼"} {delta.value}
            </span>
          ) : null}
          <p className="mt-2 text-[2.75rem] leading-none font-bold tracking-tight sm:text-[3.25rem]">
            {headline}
          </p>
          {footer ? <div className="mt-3 text-sm text-white/60">{footer}</div> : null}
        </div>

        <div className="flex shrink-0 items-end gap-3 sm:gap-4">
          {bars.map((bar, index) => {
            const height = Math.max(12, (bar.value / max) * 100);
            return (
              <div key={bar.label} className="flex w-14 flex-col items-center gap-2 sm:w-16">
                <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-ink">
                  {bar.value}
                </span>
                <div
                  className="animate-bar w-full rounded-t-xl rounded-b-md"
                  style={{
                    height: `${height * 1.28}px`,
                    animationDelay: `${index * 70}ms`,
                    backgroundImage: bar.highlight
                      ? "linear-gradient(180deg,#ffffff 0%,#b9bcfb 100%)"
                      : "linear-gradient(180deg,#3a3a4b 0%,#26262f 100%)",
                  }}
                />
                <span
                  className={`max-w-full truncate text-[11px] font-medium ${
                    bar.highlight ? "text-white" : "text-white/45"
                  }`}
                  title={bar.label}
                >
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
