import type { IconName } from "@/components/ui/Icon";
import type { Role } from "@/lib/constants";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Which badge counter, if any, hangs off this row. */
  badge?: "messages" | "notifications" | "pending";
  /** Shown in the phone tab bar (max 5). */
  mobile?: boolean;
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

const guestNav: NavGroup[] = [
  {
    label: "Discover",
    items: [
      { href: "/", label: "Home", icon: "home", mobile: true, exact: true },
      { href: "/explore", label: "Explore", icon: "search", mobile: true },
      { href: "/categories", label: "Categories", icon: "grid", mobile: true },
      { href: "/campuses", label: "Campuses", icon: "pin", mobile: true },
      { href: "/login", label: "Sign in", icon: "user", mobile: true },
    ],
  },
];

const studentNav: NavGroup[] = [
  {
    label: "Discover",
    items: [
      { href: "/", label: "Home", icon: "home", mobile: true, exact: true },
      { href: "/explore", label: "Explore", icon: "search", mobile: true },
      { href: "/categories", label: "Categories", icon: "grid" },
    ],
  },
  {
    label: "Your activity",
    items: [
      { href: "/appointments", label: "Appointments", icon: "calendar", mobile: true },
      { href: "/messages", label: "Messages", icon: "chat", badge: "messages", mobile: true },
      { href: "/favorites", label: "Saved", icon: "heart" },
      { href: "/reviews", label: "Reviews", icon: "star" },
      { href: "/notifications", label: "Notifications", icon: "bell", badge: "notifications" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/profile", label: "Profile", icon: "user", mobile: true },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

const providerNav: NavGroup[] = [
  {
    label: "Business",
    items: [
      { href: "/provider", label: "Dashboard", icon: "home", mobile: true, exact: true },
      { href: "/provider/calendar", label: "Calendar", icon: "calendar", mobile: true },
      { href: "/provider/bookings", label: "Bookings", icon: "briefcase", badge: "pending", mobile: true },
      { href: "/provider/services", label: "Services", icon: "grid" },
      { href: "/provider/availability", label: "Availability", icon: "clock" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/messages", label: "Messages", icon: "chat", badge: "messages", mobile: true },
      { href: "/provider/reviews", label: "Reviews", icon: "star" },
      { href: "/provider/promotions", label: "Promotions", icon: "sparkle" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/provider/analytics", label: "Analytics", icon: "chart" },
      { href: "/provider/earnings", label: "Earnings", icon: "money" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/provider/settings", label: "Business settings", icon: "settings", mobile: true },
      { href: "/", label: "Browse as a student", icon: "search" },
    ],
  },
];

const adminNav: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/admin", label: "Overview", icon: "chart", mobile: true, exact: true },
      { href: "/admin/users", label: "Users", icon: "users", mobile: true },
      { href: "/admin/providers", label: "Providers", icon: "briefcase", mobile: true },
      { href: "/admin/bookings", label: "Bookings", icon: "calendar", mobile: true },
    ],
  },
  {
    label: "Moderation",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "flag", mobile: true },
      { href: "/admin/reviews", label: "Reviews", icon: "star" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/categories", label: "Categories", icon: "grid" },
      { href: "/admin/universities", label: "Universities", icon: "pin" },
      { href: "/admin/settings", label: "Marketplace settings", icon: "settings" },
    ],
  },
];

/** Providers keep a student nav too — they book haircuts like everyone else. */
export function navFor(role: Role | null, area: "app" | "provider" | "admin"): NavGroup[] {
  if (area === "admin") return adminNav;
  if (area === "provider") return providerNav;
  if (!role) return guestNav;
  return studentNav;
}

export function mobileItems(groups: NavGroup[]): NavItem[] {
  return groups
    .flatMap((group) => group.items)
    .filter((item) => item.mobile)
    .slice(0, 5);
}
