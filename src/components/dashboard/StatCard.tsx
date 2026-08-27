import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

type Props = {
  label: string;
  value: ReactNode;
  icon?: IconName;
  delta?: { value: string; positive: boolean };
  hint?: string;
  href?: string;
  accessory?: ReactNode;
};

export function StatCard({ label, value, icon, delta, hint, href, accessory }: Props) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {accessory}
      </div>
      <div className="mt-3 flex items-end gap-2.5">
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
            <Icon name={icon} size={18} />
          </span>
        ) : null}
        <span className="text-[1.75rem] leading-none font-bold tracking-tight text-ink">
          {value}
        </span>
        {delta ? (
          <span
            className={`mb-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              delta.positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-ink-muted">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card card-hover block p-5">
        {body}
      </Link>
    );
  }
  return <div className="card p-5">{body}</div>;
}
