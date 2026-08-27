// Values that would be Postgres enums live here as const tuples + union types.
// Keeping them in one file means the SQLite string columns still get compile
// time exhaustiveness checking.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "CampusConnect";

export const ROLES = ["STUDENT", "PROVIDER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy a slot on the provider calendar. */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

export const PROVIDER_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "PENDING",
  "REJECTED",
  "SUSPENDED",
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const LOCATION_MODES = ["AT_PROVIDER", "AT_CUSTOMER", "ONLINE"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export const LOCATION_MODE_LABELS: Record<LocationMode, string> = {
  AT_PROVIDER: "You go to them",
  AT_CUSTOMER: "They come to you",
  ONLINE: "Online",
};

export const LOCATION_MODE_SHORT: Record<LocationMode, string> = {
  AT_PROVIDER: "At provider",
  AT_CUSTOMER: "They travel",
  ONLINE: "Online",
};

export const NOTIFICATION_TYPES = [
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_DECLINED",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "BOOKING_REMINDER",
  "BOOKING_COMPLETED",
  "MESSAGE_RECEIVED",
  "REVIEW_RECEIVED",
  "REVIEW_REPLY",
  "PROVIDER_APPROVED",
  "PROVIDER_REJECTED",
  "PAYOUT_PAID",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REPORT_REASONS = [
  "Inappropriate content",
  "Harassment or abuse",
  "Scam or fraud",
  "No-show or unprofessional",
  "Fake listing",
  "Safety concern",
  "Other",
] as const;

export const SETTING_KEYS = {
  platformFeePercent: "platform_fee_percent",
  providerAutoApprove: "provider_auto_approve",
} as const;

// --- comma-joined list helpers (stand-in for Postgres text[]) ----------------

export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function serializeList(values: readonly string[]): string {
  return Array.from(new Set(values.filter(Boolean))).join(",");
}

export function parseLocationModes(value: string | null | undefined): LocationMode[] {
  return parseList(value).filter((mode): mode is LocationMode =>
    (LOCATION_MODES as readonly string[]).includes(mode),
  );
}
