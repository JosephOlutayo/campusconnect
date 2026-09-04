import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { Booking, ProviderStats } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/dashboard/StatCard";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  await requireProvider();

  const [stats, bookings, settings] = await Promise.all([
    apiGet<ProviderStats>("/api/provider/stats"),
    apiGet<Booking[]>("/api/provider/bookings"),
    apiGet<{ platformFeePercent: number; paymentGateway: string }>("/api/stats/settings"),
  ]);

  const completed = bookings
    .filter((booking) => booking.status === "COMPLETED")
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  // Authorised but not yet captured — money promised, not yet earned.
  const pendingCapture = bookings
    .filter((booking) => booking.status === "CONFIRMED")
    .reduce((sum, booking) => sum + booking.providerPayoutCents, 0);

  const feesPaid = completed.reduce((sum, booking) => sum + booking.platformFeeCents, 0);

  return (
    <>
      <PageHeader
        title="Earnings"
        subtitle="What you have made, what is still coming, and what the platform kept."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Earned all time"
          value={formatCents(stats.earnedAllTimeCents)}
          icon="money"
        />
        <StatCard label="This month" value={formatCents(stats.earnedThisMonthCents)} icon="chart" />
        <StatCard
          label="Upcoming (authorised)"
          value={formatCents(pendingCapture)}
          icon="clock"
          hint="Captured when you mark the appointment complete"
        />
        <StatCard
          label="Platform fees paid"
          value={formatCents(feesPaid)}
          icon="briefcase"
          hint={`${settings.platformFeePercent}% of each completed booking`}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-line bg-surface-muted px-4 py-3">
        <p className="text-sm text-ink-soft">
          <strong className="text-ink">Payouts are not live yet.</strong> Payments run on the{" "}
          {settings.paymentGateway === "MOCK" ? "mock" : "Stripe"} gateway, and money is tracked per
          booking rather than transferred. Connecting Stripe Connect is what turns these figures into
          real deposits.
        </p>
      </div>

      <section>
        <SectionHeading
          title="Completed bookings"
          subtitle={`${completed.length} appointment${completed.length === 1 ? "" : "s"} you have been paid for`}
        />

        {completed.length === 0 ? (
          <EmptyState
            icon="💸"
            title="No earnings yet"
            description="Mark an appointment complete and it shows up here."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-line bg-surface-muted text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-ink-muted">Date</th>
                    <th className="px-4 py-3 font-semibold text-ink-muted">Service</th>
                    <th className="px-4 py-3 font-semibold text-ink-muted">Customer</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink-muted">Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink-muted">Fee</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink-muted">You kept</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {completed.slice(0, 50).map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {formatDate(new Date(booking.startAt))}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{booking.serviceTitle}</td>
                      <td className="px-4 py-3 text-ink-soft">{booking.customerName}</td>
                      <td className="px-4 py-3 text-right text-ink">
                        {formatCents(booking.priceCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-muted">
                        −{formatCents(booking.platformFeeCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-success">
                        {formatCents(booking.providerPayoutCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {completed.length > 50 ? (
              <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
                Showing the 50 most recent of {completed.length}.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <p className="mt-6">
        <Badge tone="neutral">
          Every booking stores its own fee split, so changing the platform rate never rewrites these
          numbers.
        </Badge>
      </p>
    </>
  );
}
