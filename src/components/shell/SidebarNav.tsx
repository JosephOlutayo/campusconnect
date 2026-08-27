"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import type { NavGroup } from "@/lib/nav";

export type BadgeCounts = { messages: number; notifications: number; pending: number };

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  groups,
  counts,
  onNavigate,
}: {
  groups: NavGroup[];
  counts: BadgeCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.09em] text-ink-faint uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const count = item.badge ? counts[item.badge] : 0;
              return (
                <li key={`${group.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? "bg-surface text-ink shadow-[var(--shadow-soft)] ring-1 ring-line"
                        : "text-ink-soft hover:bg-surface/70 hover:text-ink"
                    }`}
                  >
                    <Icon
                      name={item.icon}
                      className={active ? "text-accent" : "text-ink-muted group-hover:text-ink-soft"}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
