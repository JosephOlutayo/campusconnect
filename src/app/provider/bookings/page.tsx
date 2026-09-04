import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import { formatCents } from "@/lib/money";
import { formatFullDate, formatTimeRange } from "@/lib/time";
import { LOCATION_MODE_SHORT, type Booking } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppointmentActions } from "@/components/appointments/AppointmentActions";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type Tab = (typeof TABS)[number]["value"];

/** Filtering happens here because the API returns the provider's full list. */
function filterFor(bookings: Booking[], tab: Tab): Booking[] {
  const now = new Date();
  switch (tab) {
    case "pending":
      return bookings.filter((booking) => booking.status === "PENDING");
    case "upcoming":
      return bookings.filter(
        (booking) => booking.status === "CONFIRMED" && new Date(booking.startAt) >= now,
      );
    case "completed":
      return bookings.filter((booking) => booking.status === "COMPLETED");
    case "cancelled":
      return bookings.filter(
        (booking) => booking.status === "CANCELLED" || booking.status === "NO_SHOW",
      );
    default:
      return bookings;
  }
}

export default async function ProviderBookingsPage({
  searchParams,
}: PageProps<"/provider/bookings">) {
  await requireProvider();
  const query = await searchParams;
  const tab = (typeof query.tab === "string" ? query.tab : "all") as Tab;

  const all = await apiGet<Booking[]>("/api/provider/bookings");
  const bookings = filterFor(all, tab);

  const counts: Record<Tab, number> = {
    all: all.length,
    pending: filterFor(all, "pending").length,
    upcoming: filterFor(all, "upcoming").length,
    completed: filterFor(all, "completed").length,
    cancelled: filterFor(all, "cancelled").length,
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Accept requests, mark appointments complete and handle cancellations."
      />

      <div className="rail mb-5 -mx-1 flex gap-2 px-1">
        {TABS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "all" ? "/provider/bookings" : `/provider/bookings?tab=${option.value}`}
            className={`pill shrink-0 border transition-colors ${
              tab === option.value
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option.label}
            <span className={tab === option.value ? "text-white/70" : "text-ink-faint"}>
              {counts[option.value]}
            </span>
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Nothing here"
          description={
            tab === "pending"
              ? "No requests waiting on you right now."
              : "Bookings will show up here as students make them."
          }
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const startAt = new Date(booking.startAt);
            const endAt = new Date(booking.endAt);
            return (
              <article key={booking.id} className="card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <Avatar
                    seed={booking.customerAvatarSeed}
                    name={booking.customerName}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/provider/bookings/${booking.id}`}
                        className="text-[15px] font-bold text-ink hover:text-accent"
                      >
                        {booking.serviceTitle}
                      </Link>
                      <StatusBadge status={booking.status} />
                      <Badge tone="neutral">{booking.code}</Badge>
                    </div>

                    <p className="mt-1 text-sm text-ink-soft">
                      {booking.customerName} · {formatFullDate(startAt)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="clock" size={14} />
                        {formatTimeRange(startAt, endAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="pin" size={14} />
                        {LOCATION_MODE_SHORT[booking.locationMode]}
                      </span>
                      <span className="font-semibold text-ink">
                        {formatCents(booking.priceCents)}
                      </span>
                      <span>you keep {formatCents(booking.providerPayoutCents)}</span>
                    </div>

                    {booking.customerNote ? (
                      <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-[13px] text-ink-soft">
                        “{booking.customerNote}”
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <AppointmentActions
                      bookingId={booking.id}
                      serviceId={booking.serviceId}
                      status={booking.status}
                      role="provider"
                      cancellationPolicy={booking.cancellationPolicy}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
