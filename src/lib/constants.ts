/**
 * UI-side constants.
 *
 * The domain enums now live in Java; these are the presentation labels and the
 * option lists the forms render. Values are re-exported from types.ts so there
 * is exactly one definition of a location mode on this side of the wire.
 */

export {
  LOCATION_MODE_LABELS,
  LOCATION_MODE_SHORT,
  type LocationMode,
  type BookingStatus as AppointmentStatus,
} from "@/lib/types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "CampusConnect";

export const LOCATION_MODES = ["AT_PROVIDER", "AT_CUSTOMER", "ONLINE"] as const;

export const ROLES = ["STUDENT", "PROVIDER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const REPORT_REASONS = [
  "Inappropriate content",
  "Harassment or abuse",
  "Scam or fraud",
  "No-show or unprofessional",
  "Fake listing",
  "Safety concern",
  "Other",
] as const;

/** Weekday names indexed to match JavaScript's Date.getDay(). */
export const WEEKDAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export const WEEKDAY_LABEL: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

/** Java's DayOfWeek name for a JS Date.getDay() index (0 = Sunday). */
export function weekdayNameFromIndex(index: number): string {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][index];
}

export function weekdayIndexFromName(name: string): number {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].indexOf(name);
}
