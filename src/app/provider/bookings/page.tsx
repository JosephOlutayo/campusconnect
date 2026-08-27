import type { Metadata } from "next";
import Link from "next/link";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { formatFullDate, formatTimeRange } from "@/lib/time";
import { LOCATION_MODE_SHORT, type LocationMode } from "@/lib/constants";

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

export default async function ProviderBookingsPage({
  searchParams,
}: PageProps<"/provider/bookings">) {
  const { providerId } = await requireProvider();
  const query = await searchParams;
  const tab = (typeof query.tab === "string" ? query.tab : "all") as (typeof TABS)[number]["value"];

  const now = new Date();
  const where = {
    all: {},
    pending: { status: "PENDING" },
    upcoming: { status: "CONFIRMED", startAt: { gte: now } },
    completed: { status: "COMPLETED" },
    cancelled: { status: { in: ["CANCELLED", "NO_SHOW"] } },
  }[tab] ?? {};

  const [appointments, counts] = await Promise.all([
    prisma.appointment.findMany({
      where: { providerId, ...where },
      orderBy: tab === "completed" || tab === "cancelled" ? { startAt: "desc" } : { startAt: "asc" },
      take: 60,
      include: {
        service: { select: { id: true, title: true } },
        customer: { select: { id: true, name: true, avatarSeed: true, studentVerifiedAt: true } },
      },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { providerId },
      _count: { _all: true },
    }),
  ]);

  const pendingCount = counts.find((row) => row.status === "PENDING")?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle={
          pendingCount > 0
            ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting on you`
            : "Everything that has been booked with you"
        }
      />

      <nav className="rail mb-5 -mx-1 flex gap-2 px-1" aria-label="Filter bookings">
        {TABS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "all" ? "/provider/bookings" : `/provider/bookings?tab=${option.value}`}
            aria-current={tab === option.value ? "page" : undefined}
            className={`pill shrink-0 border transition-colors ${
              tab === option.value
                ? "border-accent bg-accent text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option.label}
            {option.value === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        ))}
      </nav>

      {appointments.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Nothing here"
          description={
            tab === "pending"
              ? "No requests waiting. When someone books, it lands here first if you review requests manually."
              : "No bookings match this filter yet."
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <article key={appointment.id} className="card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar
                  seed={appointment.customer.avatarSeed}
                  name={appointment.customer.name}
                  size="lg"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-ink">{appointment.customer.name}</p>
                    {appointment.customer.studentVerifiedAt ? (
                      <Badge tone="success">Verified student</Badge>
                    ) : null}
                    <StatusBadge status={appointment.status} short />
                    <span className="font-mono text-xs text-ink-faint">{appointment.code}</span>
                  </div>

                  <p className="mt-1 text-sm font-medium text-ink-soft">
                    {appointment.service.title}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="calendar" size={14} />
                      {formatFullDate(appointment.startAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="clock" size={14} />
                      {formatTimeRange(appointment.startAt, appointment.endAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="pin" size={14} />
                      {LOCATION_MODE_SHORT[appointment.locationMode as LocationMode] ??
                        appointment.locationLabel}
                    </span>
                  </div>

                  {appointment.customerNote ? (
                    <p className="mt-2.5 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                      “{appointment.customerNote}”
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <AppointmentActions
                      appointmentId={appointment.id}
                      serviceId={appointment.service.id}
                      status={appointment.status}
                      role="provider"
                    />
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Full details
                    </Link>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-ink">
                    {formatCents(appointment.priceCents)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    you get {formatCents(appointment.providerPayoutCents)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
