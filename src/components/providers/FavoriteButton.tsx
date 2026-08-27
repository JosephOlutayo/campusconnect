"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/Toast";

type Props = {
  providerId: string;
  initial: boolean;
  withLabel?: boolean;
};

export function FavoriteButton({ providerId, initial, withLabel = false }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initial);
  const [, startTransition] = useTransition();

  const toggle = async () => {
    // Optimistic: the heart flips instantly and rolls back only if the
    // server disagrees.
    const next = !saved;
    setSaved(next);

    const response = await fetch(`/api/favorites/${providerId}`, {
      method: next ? "POST" : "DELETE",
    });

    if (response.status === 401) {
      setSaved(!next);
      toast("Sign in to save providers.", "error");
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setSaved(!next);
      toast("Could not update your saved list.", "error");
      return;
    }

    toast(next ? "Saved to your list" : "Removed from saved");
    startTransition(() => router.refresh());
  };

  return (
    <button
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save provider"}
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-white/95 px-2.5 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] backdrop-blur transition-all hover:scale-105 ${
        saved ? "text-danger" : "text-ink-muted"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        aria-hidden
      >
        <path d="M12 20s-7-4.6-7-9.4A4.1 4.1 0 0112 8a4.1 4.1 0 017 2.6C19 15.4 12 20 12 20z" />
      </svg>
      {withLabel ? (saved ? "Saved" : "Save") : null}
    </button>
  );
}
