"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { NavItem } from "@/lib/nav";
import type { BadgeCounts } from "@/components/shell/SidebarNav";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * True while the on-screen keyboard is up.
 *
 * A fixed bottom bar repositions to the bottom of the *visual* viewport, so
 * when the keyboard opens the tab bar comes with it and lands directly under
 * whatever you are typing into. On the message thread that puts the Messages
 * tab under the composer, and a tap meant for the text box navigates away
 * mid-sentence. Comparing the visual viewport against the layout viewport is
 * the only reliable way to know the keyboard is there.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // A keyboard takes roughly a third of the screen; a URL bar hiding takes
    // far less. A quarter is comfortably between the two.
    const onResize = () => setOpen(viewport.height < window.innerHeight * 0.75);
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  return open;
}

/** Phone tab bar. Hidden from md upwards where the sidebar takes over. */
export function BottomNav({ items, counts }: { items: NavItem[]; counts: BadgeCounts }) {
  const pathname = usePathname();
  const keyboardOpen = useKeyboardOpen();

  // Out of the way entirely rather than merely behind: a transparent bar still
  // takes the tap.
  if (keyboardOpen) return null;

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
