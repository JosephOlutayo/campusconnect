import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import { formatCents } from "@/lib/money";
import type { Booking, MeSummary, PendingReview } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/dashboard/StatCard";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  await requireUser();

  const [upcoming, past, awaitingReview, summary] = await Promise.all([
    apiGet<Booking[]>("/api/bookings/upcoming"),
    apiGet<Booking[]>("/api/bookings/history"),
    apiGet<PendingReview[]>("/api/reviews/pending"),
    apiGet<MeSummary>("/api/stats/me"),
  ]);

  return (
    <>
      <PageHeader
        showDate
        title="Your appointments"
        actions={<ButtonLink href="/explore">Book something new</ButtonLink>}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming" value={upcoming.length} icon="calendar" />
        <StatCard label="Completed" value={summary.completedBookings} icon="check" />
        <StatCard
          label="Spent on campus"
          value={formatCents(summary.spentCents)}
          icon="money"
        />
      </div>

      {awaitingReview.length > 0 ? (
        <section className="mb-8">
          <SectionHeading
            title="Leave a review"
            subtitle="You completed these — a quick review helps the next student."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {awaitingReview.map((item) => (
              <div key={item.bookingId} className="card flex items-center gap-3 p-4">
                <Avatar seed={item.avatarSeed} name={item.providerName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.providerName}</p>
                  <p className="truncate text-xs text-ink-muted">{item.serviceTitle}</p>
                </div>
                <ButtonLink href={`/appointments/${item.bookingId}?review=1`} size="sm">
                  Review
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <SectionHeading title="Upcoming" subtitle={`${upcoming.length} scheduled`} />
        {upcoming.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No upcoming appointments"
            description="When you book someone, it will show up here with directions and the option to reschedule."
            action={<ButtonLink href="/explore">Find a provider</ButtonLink>}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Past" subtitle="Completed and cancelled" />
        {past.length === 0 ? (
          <EmptyState compact icon="🕓" title="Nothing in your history yet" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {past.map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
