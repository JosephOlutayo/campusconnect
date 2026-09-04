import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import { formatCents } from "@/lib/money";
import { WEEKDAY_NAMES } from "@/lib/time";
import type { Booking, ProviderStats, ServiceOffering } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireProvider();

  const [stats, bookings, services] = await Promise.all([
    apiGet<ProviderStats>("/api/provider/stats"),
    apiGet<Booking[]>("/api/provider/bookings"),
    apiGet<ServiceOffering[]>("/api/provider/services"),
  ]);

  const completed = bookings.filter((booking) => booking.status === "COMPLETED");
  const cancelled = bookings.filter(
    (booking) => booking.status === "CANCELLED" || booking.status === "NO_SHOW",
  );

  // Which weekday actually earns — useful for deciding where to open more hours.
  const byWeekday = Array.from({ length: 7 }, () => ({ count: 0, cents: 0 }));
  for (const booking of completed) {
    const day = new Date(booking.startAt).getDay();
    byWeekday[day].count += 1;
    byWeekday[day].cents += booking.providerPayoutCents;
  }
  const busiestDay = byWeekday.reduce(
    (best, entry, index) => (entry.count > byWeekday[best].count ? index : best),
    0,
  );

  // Revenue per service, so a low-price high-volume item is visible as such.
  const perService = services
    .map((service) => {
      const rows = completed.filter((booking) => booking.serviceId === service.id);
      return {
        id: service.id,
        title: service.title,
        icon: service.categoryIcon,
        bookings: rows.length,
        cents: rows.reduce((sum, booking) => sum + booking.providerPayoutCents, 0),
      };
    })
    .sort((a, b) => b.cents - a.cents);

  const totalCompleted = completed.length + cancelled.length;
  const completionRate =
    totalCompleted === 0 ? 0 : Math.round((completed.length / totalCompleted) * 100);

  const averageBooking =
    completed.length === 0
      ? 0
      : Math.round(completed.reduce((sum, b) => sum + b.priceCents, 0) / completed.length);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Where your bookings actually come from, and which services carry the business."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption="Earnings over the last four weeks"
          headline={formatCents(stats.earningsByWeek.reduce((sum, w) => sum + w.amountCents, 0))}
          bars={stats.earningsByWeek.map((week, index) => ({
            label: week.label,
            value: Math.round(week.amountCents / 100),
            highlight: index === stats.earningsByWeek.length - 1,
          }))}
          footer={`Busiest day: ${WEEKDAY_NAMES[busiestDay]}`}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Completion rate"
            value={`${completionRate}%`}
            icon="check"
            hint={`${cancelled.length} cancelled or no-show`}
          />
          <StatCard
            label="Average booking"
            value={formatCents(averageBooking)}
            icon="money"
            hint="Across completed appointments"
          />
        </div>
      </div>

      <section className="mb-8">
        <SectionHeading
          title="Revenue by service"
          subtitle="What each service has actually put in your pocket"
        />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-line bg-surface-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Service</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Completed</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Earned</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perService.map((row) => {
                  const top = perService[0]?.cents || 1;
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-ink">
                        {row.icon} {row.title}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-soft">{row.bookings}</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {formatCents(row.cents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${Math.round((row.cents / top) * 100)}%` }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="By day of week" subtitle="Completed appointments and earnings" />
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {byWeekday.map((entry, index) => (
            <div key={index} className="card p-4 text-center">
              <p className="text-xs font-semibold text-ink-muted">
                {WEEKDAY_NAMES[index].slice(0, 3)}
              </p>
              <p className="mt-1 text-xl font-bold text-ink">{entry.count}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{formatCents(entry.cents)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
