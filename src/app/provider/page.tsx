import type { Metadata } from "next";
import Link from "next/link";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderStats, getWeeklyBookings } from "@/lib/providerStats";
import { formatCents } from "@/lib/money";
import { formatTimeRange, formatTimeAgo } from "@/lib/time";

import { PageHeader, greeting } from "@/components/shell/PageHeader";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { AppointmentActions } from "@/components/appointments/AppointmentActions";

export const metadata: Metadata = { title: "Provider dashboard" };
export const dynamic = "force-dynamic";

export default async function ProviderDashboard() {
  const { user, providerId } = await requireProvider();

  const [stats, weekly, pendingRequests, recentReviews] = await Promise.all([
    getProviderStats(providerId),
    getWeeklyBookings(providerId),
    prisma.appointment.findMany({
      where: { providerId, status: "PENDING" },
      orderBy: { startAt: "asc" },
      take: 5,
      include: {
        service: { select: { id: true, title: true } },
        customer: { select: { name: true, avatarSeed: true, studentVerifiedAt: true } },
      },
    }),
    prisma.review.findMany({
      where: { providerId, isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { name: true, avatarSeed: true } } },
    }),
  ]);

  const trend = stats.completedThisMonth - stats.lastMonthCompleted;

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
            <ButtonLink href={`/providers/${providerId}`}>View public profile</ButtonLink>
          </>
        }
      />

      {stats.status !== "ACTIVE" ? (
        <div className="mb-5 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          Your listing is <strong>{stats.status.toLowerCase()}</strong> — students cannot find or
          book you right now.{" "}
          <Link href="/provider/settings" className="underline">
            Open business settings
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <FeatureChart
              caption="Your earnings this month"
              headline={formatCents(stats.earnedThisMonthCents)}
              delta={
                trend !== 0
                  ? { value: `${Math.abs(trend)} vs last month`, positive: trend > 0 }
                  : undefined
              }
              bars={weekly.map((week, index) => ({
                label: week.label,
                value: week.count,
                highlight: index === weekly.length - 1,
              }))}
              footer={`${stats.completedThisMonth} completed appointment${stats.completedThisMonth === 1 ? "" : "s"} this month`}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatCard
                label="Pending requests"
                value={stats.pending}
                icon="bell"
                hint={stats.pending > 0 ? "Waiting on you to accept" : "Nothing waiting"}
                href="/provider/bookings"
              />
              <StatCard
                label="Rating"
                value={stats.ratingAvg > 0 ? stats.ratingAvg.toFixed(1) : "—"}
                icon="star"
                hint={`${stats.ratingCount} review${stats.ratingCount === 1 ? "" : "s"}`}
                href="/provider/reviews"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Upcoming" value={stats.upcoming} icon="calendar" href="/provider/calendar" />
            <StatCard label="Completed all time" value={stats.completedBookings} icon="check" />
            <StatCard
              label="Earned all time"
              value={formatCents(stats.earnedAllTimeCents)}
              icon="money"
              href="/provider/earnings"
            />
          </div>

          <section>
            <SectionHeading
              title="Today"
              subtitle={
                stats.todays.length > 0
                  ? `${stats.todays.length} appointment${stats.todays.length === 1 ? "" : "s"}`
                  : "Nothing on the calendar"
              }
              action={
                <Link href="/provider/calendar" className="text-sm font-semibold text-accent hover:underline">
                  Calendar
                </Link>
              }
            />

            {stats.todays.length === 0 ? (
              <EmptyState
                compact
                icon="☕"
                title="A clear day"
                description="No appointments today. Good time to add photos to your portfolio."
              />
            ) : (
              <div className="space-y-3">
                {stats.todays.map((appointment) => (
                  <article key={appointment.id} className="card flex items-center gap-4 p-4">
                    <div className="w-20 shrink-0 text-center">
                      <p className="text-sm font-bold text-ink">
                        {appointment.startAt.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {appointment.service.durationMinutes} min
                      </p>
                    </div>
                    <span className="h-10 w-px shrink-0 bg-line" />
                    <Avatar
                      seed={appointment.customer.avatarSeed}
                      name={appointment.customer.name}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {appointment.customer.name}
                      </p>
                      <p className="truncate text-xs text-ink-muted">{appointment.service.title}</p>
                    </div>
                    <StatusBadge status={appointment.status} short />
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="shrink-0 rounded-lg p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      aria-label="Open appointment"
                    >
                      <Icon name="chevronRight" size={18} />
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          {pendingRequests.length > 0 ? (
            <section>
              <SectionHeading
                title="Needs your answer"
                subtitle="These students are waiting for you to accept or decline"
              />
              <div className="space-y-3">
                {pendingRequests.map((appointment) => (
                  <article key={appointment.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <Avatar
                        seed={appointment.customer.avatarSeed}
                        name={appointment.customer.name}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink">
                            {appointment.customer.name}
                          </p>
                          {appointment.customer.studentVerifiedAt ? (
                            <Badge tone="success">Verified student</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[13px] text-ink-soft">
                          {appointment.service.title} ·{" "}
                          {appointment.startAt.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {formatTimeRange(appointment.startAt, appointment.endAt)}
                        </p>
                        {appointment.customerNote ? (
                          <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                            “{appointment.customerNote}”
                          </p>
                        ) : null}
                        <div className="mt-3">
                          <AppointmentActions
                            appointmentId={appointment.id}
                            serviceId={appointment.service.id}
                            status={appointment.status}
                            role="provider"
                          />
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-ink">
                        {formatCents(appointment.priceCents)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Recent reviews</h2>
              <Link href="/provider/reviews" className="text-xs font-semibold text-accent hover:underline">
                All
              </Link>
            </div>
            {recentReviews.length === 0 ? (
              <p className="text-sm text-ink-muted">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {recentReviews.map((review) => (
                  <div key={review.id}>
                    <div className="flex items-center gap-2">
                      <Avatar seed={review.author.avatarSeed} name={review.author.name} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                        {review.author.name}
                      </span>
                      <span className="text-[11px] text-ink-muted">
                        {formatTimeAgo(review.createdAt)}
                      </span>
                    </div>
                    <Stars rating={review.rating} size="sm" showNumber={false} className="mt-1.5" />
                    <p className="mt-1 line-clamp-3 text-[13px] text-ink-soft">{review.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Quick actions</h2>
            <div className="grid gap-2">
              {[
                { href: "/provider/availability" as const, label: "Update your hours", icon: "clock" as const },
                { href: "/provider/services" as const, label: "Edit services and prices", icon: "grid" as const },
                { href: "/provider/promotions" as const, label: "Run a promotion", icon: "sparkle" as const },
                { href: "/provider/analytics" as const, label: "See what sells", icon: "chart" as const },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl bg-surface-muted px-3.5 py-3 text-sm font-medium text-ink transition-colors hover:bg-accent-soft hover:text-accent"
                >
                  <Icon name={action.icon} size={17} />
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
