"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import type { NavItem } from "@/lib/nav";
import type { BadgeCounts } from "@/components/shell/SidebarNav";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Phone tab bar. Hidden from md upwards where the sidebar takes over. */
export function BottomNav({ items, counts }: { items: NavItem[]; counts: BadgeCounts }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-lg md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                  active ? "text-accent" : "text-ink-muted"
                }`}
              >
                <span className="relative">
                  <Icon name={item.icon} size={22} />
                  {count > 0 ? (
                    <span className="absolute -top-1 -right-2 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </span>
                {item.label}
                {active ? (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-accent" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
