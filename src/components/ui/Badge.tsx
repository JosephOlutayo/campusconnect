import type { ReactNode } from "react";

import type { AppointmentStatus } from "@/lib/constants";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-soft",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  dark: "bg-feature text-white",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`pill ${tones[tone]} ${className}`}>{children}</span>;
}

const statusTone: Record<AppointmentStatus, Tone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  COMPLETED: "info",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

const statusLabel: Record<AppointmentStatus, string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function StatusBadge({ status, short = false }: { status: string; short?: boolean }) {
  const key = (status as AppointmentStatus) ?? "PENDING";
  const tone = statusTone[key] ?? "neutral";
  const label = short ? key.replace("_", " ").toLowerCase() : (statusLabel[key] ?? status);
  return <Badge tone={tone} className={short ? "capitalize" : ""}>{label}</Badge>;
}

/** The blue tick. Only ever shown when the platform actually verified them. */
export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="pill bg-info-soft text-info" title="Identity checked by CampusConnect">
      <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden>
        <path d="M10 1.5l2.02 1.47 2.5-.13.86 2.35 2.12 1.33-.87 2.35.87 2.35-2.12 1.33-.86 2.35-2.5-.13L10 18.5l-2.02-1.47-2.5.13-.86-2.35L2.5 13.5l.87-2.35L2.5 8.8l2.12-1.33.86-2.35 2.5.13L10 1.5zm-.9 10.9l4.2-4.2-1.2-1.2-3 3-1.3-1.3-1.2 1.2 2.5 2.5z" />
      </svg>
      {label}
    </span>
  );
}
