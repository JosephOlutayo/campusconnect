import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import { formatCents } from "@/lib/money";
import { isSameDay } from "@/lib/time";
import type { Booking, ProviderStats } from "@/lib/types";

import { PageHeader, greeting } from "@/components/shell/PageHeader";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Provider dashboard" };
export const dynamic = "force-dynamic";

export default async function ProviderDashboard() {
  const user = await requireProvider();

  const [stats, bookings] = await Promise.all([
    apiGet<ProviderStats>("/api/provider/stats"),
    apiGet<Booking[]>("/api/provider/bookings"),
  ]);

  const now = new Date();
  const upcoming = bookings
    .filter((booking) => ["PENDING", "CONFIRMED"].includes(booking.status))
    .filter((booking) => new Date(booking.startAt) >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const today = upcoming.filter((booking) => isSameDay(new Date(booking.startAt), now));
  const pending = bookings.filter((booking) => booking.status === "PENDING");

  // Bars are in whole dollars — cents would make every bar look identical.
  const bars = stats.earningsByWeek.map((week, index) => ({
    label: week.label,
    value: Math.round(week.amountCents / 100),
    highlight: index === stats.earningsByWeek.length - 1,
  }));

  return (
    <>
      <PageHeader
        showDate
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        actions={
          <>
            <ButtonLink href="/provider/services" variant="secondary">
              <Icon name="plus" size={16} />
              Add service
            </ButtonLink>
            <ButtonLink href={`/providers/${user.providerProfileId}`}>
              View public profile
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption="Your earnings this month"
          headline={formatCents(stats.earnedThisMonthCents)}
          bars={bars.length > 0 ? bars : [{ label: "This wk", value: 0, highlight: true }]}
          footer={`${stats.completedAllTime} completed appointments all time`}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Pending requests"
            value={stats.pendingRequests}
            icon="bell"
            hint={stats.pendingRequests > 0 ? "Waiting on you" : "Nothing waiting"}
            href="/provider/bookings"
          />
          <StatCard
            label="Rating"
            value={stats.ratingAvg > 0 ? stats.ratingAvg.toFixed(1) : "—"}
            icon="star"
            hint={`${stats.ratingCount} reviews`}
            href="/provider/reviews"
          />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Upcoming"
          value={upcoming.length}
          icon="calendar"
          href="/provider/calendar"
        />
        <StatCard label="Completed all time" value={stats.completedAllTime} icon="check" />
        <StatCard
          label="Earned all time"
          value={formatCents(stats.earnedAllTimeCents)}
          icon="money"
          href="/provider/earnings"
        />
      </div>

      {pending.length > 0 ? (
        <section className="mb-8">
          <SectionHeading
            title="Waiting for your answer"
            subtitle="These students are holding a slot until you accept or decline."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} perspective="provider" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <SectionHeading
          title="Today"
          subtitle={`${today.length} appointment${today.length === 1 ? "" : "s"}`}
        />
        {today.length === 0 ? (
          <EmptyState compact icon="☕" title="Nothing on today" description="Enjoy the quiet one." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {today.map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} perspective="provider" />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Coming up"
          subtitle="The next appointments on your calendar"
          action={
            <ButtonLink href="/provider/calendar" variant="ghost" size="sm">
              Full calendar
            </ButtonLink>
          }
        />
        {upcoming.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No upcoming bookings"
            description="Once students book you, they show up here. Check your availability is open."
            action={<ButtonLink href="/provider/availability">Set availability</ButtonLink>}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.slice(0, 6).map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} perspective="provider" />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
