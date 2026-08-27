import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { getPastAppointments, getUpcomingAppointments } from "@/lib/queries";
import { pendingReviews } from "@/lib/reviews";

import { PageHeader } from "@/components/shell/PageHeader";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const user = await requireUser();

  const [upcoming, past, awaitingReview, spend] = await Promise.all([
    getUpcomingAppointments(user.id, 20),
    getPastAppointments(user.id, 20),
    pendingReviews(user.id),
    prisma.appointment.aggregate({
      where: { customerId: user.id, status: "COMPLETED" },
      _sum: { priceCents: true },
      _count: { _all: true },
    }),
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
        <StatCard label="Completed" value={spend._count._all} icon="check" />
        <StatCard
          label="Spent on campus"
          value={formatCents(spend._sum.priceCents ?? 0)}
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
            {awaitingReview.map((appointment) => (
              <div key={appointment.id} className="card flex items-center gap-3 p-4">
                <Avatar
                  seed={appointment.provider.user.avatarSeed}
                  name={appointment.provider.businessName}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {appointment.provider.businessName}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{appointment.service.title}</p>
                </div>
                <ButtonLink href={`/appointments/${appointment.id}?review=1`} size="sm">
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
            {upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
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
            {past.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={{ ...appointment, endAt: appointment.endAt }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
