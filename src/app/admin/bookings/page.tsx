import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

const FILTERS = ["all", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "all";

  const [appointments, totals] = await Promise.all([
    prisma.appointment.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        service: { select: { title: true } },
        customer: { select: { name: true } },
        provider: { select: { id: true, businessName: true } },
      },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { priceCents: true, platformFeeCents: true },
    }),
  ]);

  const completed = totals.find((row) => row.status === "COMPLETED");
  const cancelled = totals.find((row) => row.status === "CANCELLED");
  const allCount = totals.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every appointment across the platform." />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={allCount} icon="calendar" />
        <StatCard label="Completed" value={completed?._count._all ?? 0} icon="check" />
        <StatCard
          label="Gross volume"
          value={formatCents(completed?._sum.priceCents ?? 0)}
          icon="money"
        />
        <StatCard
          label="Platform revenue"
          value={formatCents(completed?._sum.platformFeeCents ?? 0)}
          icon="chart"
          hint={`${cancelled?._count._all ?? 0} cancelled`}
        />
      </div>

      <nav className="rail mb-5 -mx-1 flex gap-2 px-1">
        {FILTERS.map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/admin/bookings" : `/admin/bookings?status=${option}`}
            aria-current={status === option ? "page" : undefined}
            className={`pill shrink-0 border capitalize transition-colors ${
              status === option
                ? "border-accent bg-accent text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option === "all" ? "All" : option.replace("_", " ").toLowerCase()}
          </Link>
        ))}
      </nav>

      {appointments.length === 0 ? (
        <EmptyState icon="📅" title="No bookings match this filter" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Code</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">When</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Customer</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Provider</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Service</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      <Link
                        href={`/appointments/${appointment.id}`}
                        className="text-accent hover:underline"
                      >
                        {appointment.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {formatDate(appointment.startAt)} {formatTime(appointment.startAt)}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{appointment.customer.name}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/providers/${appointment.provider.id}`}
                        className="text-ink-soft hover:text-accent"
                      >
                        {appointment.provider.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{appointment.service.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appointment.status} short />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatCents(appointment.priceCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted">
                      {formatCents(appointment.platformFeeCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
