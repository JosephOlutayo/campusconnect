import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { formatFullDate, formatTime } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/dashboard/StatCard";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

type BookingRow = {
  id: string;
  code: string;
  status: string;
  startAt: string;
  customerName: string;
  providerName: string;
  serviceTitle: string;
  priceCents: number;
  platformFeeCents: number;
};

export default async function AdminBookingsPage() {
  const bookings = await apiGet<BookingRow[]>("/api/admin/bookings");

  const gross = bookings.reduce(
    (sum, booking) => (booking.status === "CANCELLED" ? sum : sum + booking.priceCents),
    0,
  );
  const fees = bookings.reduce(
    (sum, booking) => (booking.status === "COMPLETED" ? sum + booking.platformFeeCents : sum),
    0,
  );

  return (
    <>
      <PageHeader title="Bookings" subtitle="The 200 most recent across the platform." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Shown" value={bookings.length} icon="calendar" />
        <StatCard label="Gross volume" value={formatCents(gross)} icon="money" />
        <StatCard label="Platform fees" value={formatCents(fees)} icon="briefcase" />
      </div>

      {bookings.length === 0 ? (
        <EmptyState icon="📋" title="No bookings yet" />
      ) : (
        <div className="card overflow-hidden">
          {/* The table scrolls inside its own container so the page never does. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="border-b border-line bg-surface-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Code</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">When</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Service</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Customer</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Provider</th>
                  <th className="px-4 py-3 font-semibold text-ink-muted">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink-muted">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookings.map((booking) => {
                  const startAt = new Date(booking.startAt);
                  return (
                    <tr key={booking.id}>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">{booking.code}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                        {formatFullDate(startAt)} · {formatTime(startAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        <Link href={`/appointments/${booking.id}`} className="hover:text-accent">
                          {booking.serviceTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{booking.customerName}</td>
                      <td className="px-4 py-3 text-ink-soft">{booking.providerName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={booking.status} short />
                      </td>
                      <td className="px-4 py-3 text-right text-ink">
                        {formatCents(booking.priceCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-muted">
                        {formatCents(booking.platformFeeCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
