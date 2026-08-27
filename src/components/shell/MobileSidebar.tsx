"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";

/**
 * The phone drawer reuses the exact sidebar markup passed as children, so the
 * two navigations can never drift apart.
 */
export function MobileSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Any navigation closes the drawer. Adjusting during render (rather than in
  // an effect) means the closed drawer paints in the same commit as the new
  // route, with no flash of the old panel over the new page.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-surface-sunken md:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-feature/40 backdrop-blur-[2px]"
          />
          <div className="animate-rise absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col border-r border-line bg-surface-muted">
            <div className="flex justify-end p-3">
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-ink-muted hover:bg-surface"
              >
                <Icon name="plus" className="rotate-45" size={22} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
