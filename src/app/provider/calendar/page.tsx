import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import type { Booking } from "@/lib/types";
import { formatCents } from "@/lib/money";
import {
  addDays,
  endOfDay,
  endOfMonth,
  formatFullDate,
  formatTime,
  isSameDay,
  isValidDateKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  WEEKDAY_SHORT,
} from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

const VIEWS = ["day", "week", "month"] as const;
type View = (typeof VIEWS)[number];

export default async function CalendarPage({ searchParams }: PageProps<"/provider/calendar">) {
  await requireProvider();
  const query = await searchParams;

  const view = (VIEWS.includes(query.view as View) ? query.view : "week") as View;
  const anchorKey = typeof query.date === "string" && isValidDateKey(query.date) ? query.date : null;
  const anchor = anchorKey ? new Date(`${anchorKey}T00:00:00`) : new Date();

  const range = {
    day: { from: startOfDay(anchor), to: endOfDay(anchor) },
    week: { from: startOfWeek(anchor), to: endOfDay(addDays(startOfWeek(anchor), 6)) },
    month: { from: startOfMonth(anchor), to: endOfMonth(anchor) },
  }[view];

  const [allBookings, allTimeOff] = await Promise.all([
    apiGet<Booking[]>("/api/provider/bookings"),
    apiGet<Array<{ id: string; startAt: string; endAt: string; reason: string }>>(
      "/api/provider/time-off",
    ),
  ]);

  // The API hands back the whole list; narrowing to the visible range here keeps
  // the calendar to a single request no matter which view is showing.
  const appointments = allBookings
    .filter((booking) => booking.status !== "CANCELLED")
    .map((booking) => ({
      id: booking.id,
      startAt: new Date(booking.startAt),
      endAt: new Date(booking.endAt),
      status: booking.status,
      priceCents: booking.priceCents,
      locationLabel: booking.locationLabel,
      service: { title: booking.serviceTitle, durationMinutes: booking.durationMinutes },
      customer: { name: booking.customerName, avatarSeed: booking.customerAvatarSeed },
    }))
    .filter((booking) => booking.startAt >= range.from && booking.startAt <= range.to)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const timeOff = allTimeOff
    .map((entry) => ({
      id: entry.id,
      startAt: new Date(entry.startAt),
      endAt: new Date(entry.endAt),
      reason: entry.reason || null,
    }))
    .filter((entry) => entry.startAt <= range.to && entry.endAt >= range.from);

  // Cancelled bookings are already filtered out, so this is money actually on
  // the calendar for the period being viewed.
  const revenue = appointments.reduce((sum, booking) => sum + booking.priceCents, 0);

  const title =
    view === "day"
      ? formatFullDate(anchor)
      : view === "month"
        ? anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : `Week of ${formatFullDate(startOfWeek(anchor))}`;

  // Step the anchor by whichever unit the current view shows.
  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const prevKey = toDateKey(addDays(anchor, -step));
  const nextKey = toDateKey(addDays(anchor, step));

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`${appointments.length} appointment${appointments.length === 1 ? "" : "s"} · ${formatCents(revenue)} in this ${view}`}
        actions={
          <div className="flex rounded-xl bg-surface-sunken p-1">
            {VIEWS.map((option) => (
              <Link
                key={option}
                href={`/provider/calendar?view=${option}&date=${toDateKey(anchor)}`}
                aria-current={view === option ? "page" : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-all ${
                  view === option
                    ? "bg-surface text-ink shadow-[var(--shadow-soft)]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href={`/provider/calendar?view=${view}&date=${prevKey}`}
          aria-label="Previous"
          className="rounded-xl border border-line p-2 text-ink-soft hover:bg-surface-muted"
        >
          <Icon name="arrowLeft" size={18} />
        </Link>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <Link
          href={`/provider/calendar?view=${view}&date=${nextKey}`}
          aria-label="Next"
          className="rounded-xl border border-line p-2 text-ink-soft hover:bg-surface-muted"
        >
          <Icon name="arrowRight" size={18} />
        </Link>
      </div>

      {view === "month" ? (
        <MonthGrid anchor={anchor} appointments={appointments} />
      ) : (
        <div className="space-y-6">
          {Array.from({ length: view === "day" ? 1 : 7 }, (_, index) => {
            const day = view === "day" ? anchor : addDays(startOfWeek(anchor), index);
            const dayAppointments = appointments.filter((appointment) =>
              isSameDay(appointment.startAt, day),
            );
            const dayBlocks = timeOff.filter(
              (block) => block.startAt <= endOfDay(day) && block.endAt >= startOfDay(day),
            );
            const isToday = isSameDay(day, new Date());

            return (
              <section key={toDateKey(day)}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span
                    className={`grid size-9 place-items-center rounded-xl text-sm font-bold ${
                      isToday ? "bg-feature text-white" : "bg-surface-sunken text-ink"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{WEEKDAY_SHORT[day.getDay()]}</p>
                    <p className="text-xs text-ink-muted">
                      {dayAppointments.length === 0
                        ? "Nothing booked"
                        : `${dayAppointments.length} appointment${dayAppointments.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>

                {dayBlocks.length > 0 ? (
                  <p className="mb-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                    Blocked off: {dayBlocks.map((block) => block.reason ?? "Time off").join(", ")}
                  </p>
                ) : null}

                {dayAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-faint">
                    Open
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayAppointments.map((appointment) => (
                      <Link
                        key={appointment.id}
                        href={`/appointments/${appointment.id}`}
                        className="card card-hover flex items-center gap-3 p-3"
                      >
                        <span className="w-16 shrink-0 text-xs font-bold text-ink">
                          {formatTime(appointment.startAt)}
                        </span>
                        <Avatar
                          seed={appointment.customer.avatarSeed}
                          name={appointment.customer.name}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {appointment.customer.name}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            {appointment.service.title}
                          </span>
                        </span>
                        <StatusBadge status={appointment.status} short />
                        <span className="shrink-0 text-sm font-bold text-ink">
                          {formatCents(appointment.priceCents)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {appointments.length === 0 && view !== "month" ? (
        <div className="mt-6">
          <EmptyState
            compact
            icon="📆"
            title="No appointments in this range"
            description="Students can only book inside your availability windows — check those if it stays quiet."
          />
        </div>
      ) : null}
    </>
  );
}

function MonthGrid({
  anchor,
  appointments,
}: {
  anchor: Date;
  appointments: Array<{ id: string; startAt: Date; status: string }>;
}) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  const byDay = new Map<string, number>();
  for (const appointment of appointments) {
    const key = toDateKey(appointment.startAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-surface-muted">
        {WEEKDAY_SHORT.map((day) => (
          <div key={day} className="p-2 text-center text-[11px] font-bold text-ink-muted">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const key = toDateKey(day);
          const count = byDay.get(key) ?? 0;
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = isSameDay(day, new Date());

          return (
            <Link
              key={key}
              href={`/provider/calendar?view=day&date=${key}`}
              className={`flex min-h-16 flex-col items-center gap-1 border-r border-b border-line p-2 transition-colors last:border-r-0 hover:bg-surface-muted ${
                inMonth ? "" : "opacity-35"
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-feature text-white" : "text-ink"
                }`}
              >
                {day.getDate()}
              </span>
              {count > 0 ? (
                <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-bold text-accent">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
