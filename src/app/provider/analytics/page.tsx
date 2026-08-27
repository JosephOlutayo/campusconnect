import type { Metadata } from "next";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderStats, getServicePerformance, getWeeklyBookings } from "@/lib/providerStats";
import { formatCents } from "@/lib/money";
import { addDays, startOfDay, WEEKDAY_NAMES } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { providerId } = await requireProvider();

  const [stats, weekly, services, last90] = await Promise.all([
    getProviderStats(providerId),
    getWeeklyBookings(providerId, 6),
    getServicePerformance(providerId),
    prisma.appointment.findMany({
      where: { providerId, startAt: { gte: addDays(startOfDay(new Date()), -90) } },
      select: { startAt: true, status: true },
    }),
  ]);

  // Which weekday and hour actually convert — useful for deciding where to
  // open more hours.
  const byWeekday = WEEKDAY_NAMES.map((name, index) => ({
    name,
    count: last90.filter(
      (appointment) => appointment.startAt.getDay() === index && appointment.status !== "CANCELLED",
    ).length,
  }));
  const busiestDay = [...byWeekday].sort((a, b) => b.count - a.count)[0];

  const hourBuckets = [
    { label: "Morning", from: 6, to: 12 },
    { label: "Afternoon", from: 12, to: 17 },
    { label: "Evening", from: 17, to: 22 },
  ].map((bucket) => ({
    ...bucket,
    count: last90.filter((appointment) => {
      const hour = appointment.startAt.getHours();
      return hour >= bucket.from && hour < bucket.to && appointment.status !== "CANCELLED";
    }).length,
  }));

  const total = last90.filter((appointment) => appointment.status !== "CANCELLED").length;
  const cancelled = last90.filter((appointment) => appointment.status === "CANCELLED").length;
  const noShows = last90.filter((appointment) => appointment.status === "NO_SHOW").length;
  const cancelRate = last90.length > 0 ? Math.round((cancelled / last90.length) * 100) : 0;

  const topService = services[0];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="The last 90 days of your business, in the numbers that change what you do next."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption="Bookings per week"
          headline={String(total)}
          bars={weekly.map((week, index) => ({
            label: week.label,
            value: week.count,
            highlight: index === weekly.length - 1,
          }))}
          footer={
            busiestDay && busiestDay.count > 0
              ? `${busiestDay.name} is your busiest day — ${busiestDay.count} bookings in 90 days`
              : "Not enough history yet"
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Cancellation rate"
            value={`${cancelRate}%`}
            icon="ban"
            hint={`${cancelled} cancelled, ${noShows} no-show`}
          />
          <StatCard
            label="Earned all time"
            value={formatCents(stats.earnedAllTimeCents)}
            icon="money"
            hint={`${formatCents(stats.feesAllTimeCents)} in platform fees`}
          />
        </div>
      </div>

      <section className="mb-6">
        <SectionHeading
          title="What sells"
          subtitle="Completed bookings and take-home earnings by service"
        />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-line bg-surface-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Service</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Price</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Completed</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {services.map((service) => (
                  <tr key={service.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{service.title}</span>
                      {!service.isActive ? (
                        <span className="ml-2 text-xs text-ink-faint">(paused)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatCents(service.priceCents)}</td>
                    <td className="px-4 py-3 text-ink-soft">{service.completed}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink">
                      {formatCents(service.earnedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {topService && topService.earnedCents > 0 ? (
          <p className="mt-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
            <strong>{topService.title}</strong> earns you the most. If you want more hours to pay
            off, open them where this one gets booked.
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeading title="When people book" subtitle="Last 90 days" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">By day</h3>
            <div className="space-y-2">
              {byWeekday.map((day) => {
                const max = Math.max(1, ...byWeekday.map((entry) => entry.count));
                return (
                  <div key={day.name} className="flex items-center gap-3">
                    <span className="w-9 text-xs font-medium text-ink-muted">
                      {day.name.slice(0, 3)}
                    </span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(day.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-xs font-semibold text-ink">
                      {day.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">By time of day</h3>
            <div className="space-y-2">
              {hourBuckets.map((bucket) => {
                const max = Math.max(1, ...hourBuckets.map((entry) => entry.count));
                return (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-ink-muted">{bucket.label}</span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                      <span
                        className="block h-full rounded-full bg-feature"
                        style={{ width: `${(bucket.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-xs font-semibold text-ink">
                      {bucket.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
