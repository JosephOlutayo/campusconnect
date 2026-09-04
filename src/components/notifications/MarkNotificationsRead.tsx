"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Marks everything read once the page has painted.
 *
 * This runs on the client rather than during the server render for two reasons:
 * a GET should not have side effects, and doing it after paint means the unread
 * dots are still visible on the notifications you just arrived to read.
 */
export function MarkNotificationsRead({ unread }: { unread: number }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (unread === 0 || done.current) return;
    done.current = true;

    const timer = setTimeout(async () => {
      await fetch("/api/notifications/read", { method: "POST" }).catch(() => null);
      // Refresh so the sidebar badge clears without a manual reload.
      router.refresh();
    }, 1200);

    return () => clearTimeout(timer);
  }, [unread, router]);

  return null;
}
