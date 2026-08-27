import type { Metadata } from "next";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderStats } from "@/lib/providerStats";
import { getPlatformFeePercent } from "@/lib/settings";
import { activeGateway } from "@/lib/payments";
import { formatCents } from "@/lib/money";
import { formatDate, formatFullDate } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const { providerId } = await requireProvider();

  const [stats, feePercent, payouts, recent, pendingCapture] = await Promise.all([
    getProviderStats(providerId),
    getPlatformFeePercent(),
    prisma.payout.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } }),
    prisma.appointment.findMany({
      where: { providerId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 20,
      include: {
        service: { select: { title: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.appointment.aggregate({
      where: { providerId, status: "CONFIRMED" },
      _sum: { providerPayoutCents: true },
      _count: { _all: true },
    }),
  ]);

  const paidOut = payouts
    .filter((payout) => payout.status === "PAID")
    .reduce((sum, payout) => sum + payout.amountCents, 0);
  const availableCents = stats.earnedAllTimeCents - paidOut;
  const gateway = activeGateway();

  return (
    <>
      <PageHeader
        title="Earnings"
        subtitle={`You keep ${100 - feePercent}% of every completed booking.`}
      />

      {gateway === "MOCK" ? (
        <div className="mb-5 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <strong>Test mode.</strong> No real money moves yet — these figures come from the mock
          payment gateway. Adding a Stripe secret key switches the same flow to live Connect
          payouts without changing any of these numbers.
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="This month"
          value={formatCents(stats.earnedThisMonthCents)}
          icon="money"
          hint={`${stats.completedThisMonth} completed`}
        />
        <StatCard
          label="Available"
          value={formatCents(Math.max(0, availableCents))}
          icon="check"
          hint="Earned but not yet paid out"
        />
        <StatCard
          label="Upcoming"
          value={formatCents(pendingCapture._sum.providerPayoutCents ?? 0)}
          icon="clock"
          hint={`${pendingCapture._count._all} confirmed, not yet completed`}
        />
        <StatCard
          label="All time"
          value={formatCents(stats.earnedAllTimeCents)}
          icon="chart"
          hint={`after ${formatCents(stats.feesAllTimeCents)} in fees`}
        />
      </div>

      <section className="mb-8">
        <SectionHeading title="How the split works" />
        <div className="card p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Customers paid
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {formatCents(stats.grossAllTimeCents)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Platform fee ({feePercent}%)
              </p>
              <p className="mt-1 text-2xl font-bold text-ink-muted">
                −{formatCents(stats.feesAllTimeCents)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                You keep
              </p>
              <p className="mt-1 text-2xl font-bold text-success">
                {formatCents(stats.earnedAllTimeCents)}
              </p>
            </div>
          </div>
          <p className="mt-4 border-t border-line pt-4 text-xs text-ink-muted">
            The fee is calculated per booking and stored with it, so changing the platform fee later
            never rewrites what you already earned.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <SectionHeading title="Payouts" subtitle="Transfers to your bank" />
        {payouts.length === 0 ? (
          <EmptyState
            compact
            icon="🏦"
            title="No payouts yet"
            description="Once Stripe Connect onboarding is live, completed bookings pay out on a rolling schedule."
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {payout.paidAt ? `Paid ${formatFullDate(payout.paidAt)}` : "Scheduled"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={payout.status === "PAID" ? "success" : "warning"}>
                    {payout.status.toLowerCase()}
                  </Badge>
                  <p className="text-base font-bold text-ink">{formatCents(payout.amountCents)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Recent completed bookings" />
        {recent.length === 0 ? (
          <EmptyState compact icon="💸" title="Nothing completed yet" />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-line bg-surface-muted text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-ink-muted">Date</th>
                    <th className="px-4 py-3 font-semibold text-ink-muted">Customer</th>
                    <th className="px-4 py-3 font-semibold text-ink-muted">Service</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink-muted">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink-muted">Fee</th>
                    <th className="px-4 py-3 text-right font-semibold text-ink-muted">You get</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                        {formatDate(appointment.startAt)}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{appointment.customer.name}</td>
                      <td className="px-4 py-3 text-ink-soft">{appointment.service.title}</td>
                      <td className="px-4 py-3 text-right text-ink-soft">
                        {formatCents(appointment.priceCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-muted">
                        −{formatCents(appointment.platformFeeCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink">
                        {formatCents(appointment.providerPayoutCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
