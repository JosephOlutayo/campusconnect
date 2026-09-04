import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatCents } from "@/lib/money";
import { durationLabel, formatRelativeDay, formatTimeRange } from "@/lib/time";
import type { Booking } from "@/lib/types";

type Props = {
  booking: Booking;
  compact?: boolean;
  /** Provider-side cards lead with the customer, not the business. */
  perspective?: "customer" | "provider";
};

export function AppointmentCard({ booking, compact = false, perspective = "customer" }: Props) {
  const isProviderView = perspective === "provider";
  const title = isProviderView ? booking.customerName : booking.providerName;
  const seed = isProviderView ? booking.customerAvatarSeed : booking.providerAvatarSeed;
  const href = isProviderView
    ? `/provider/bookings/${booking.id}`
    : `/appointments/${booking.id}`;

  // The API sends local date-times without a zone, which new Date() reads as local.
  const startAt = new Date(booking.startAt);
  const endAt = new Date(booking.endAt);

  return (
    <Link
      href={href}
      className="card card-hover block p-4"
      aria-label={`${booking.serviceTitle} with ${title}`}
    >
      <div className="flex items-start gap-3">
        <Avatar seed={seed} name={title} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-ink">{booking.serviceTitle}</p>
            <StatusBadge status={booking.status} short />
          </div>
          <p className="truncate text-[13px] text-ink-muted">{title}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <Icon name="calendar" size={14} className="text-ink-muted" />
              {formatRelativeDay(startAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Icon name="clock" size={14} className="text-ink-muted" />
              {formatTimeRange(startAt, endAt)}
            </span>
          </div>

          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon name="pin" size={14} />
                <span className="truncate">{booking.locationLabel}</span>
              </span>
              <span className="font-semibold text-ink">{formatCents(booking.priceCents)}</span>
              <span>{durationLabel(booking.durationMinutes)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
