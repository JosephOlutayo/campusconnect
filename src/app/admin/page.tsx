import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { formatCents } from "@/lib/money";
import type { CampusOverview } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Admin overview" };
export const dynamic = "force-dynamic";

type Overview = {
  totalUsers: number;
  totalStudents: number;
  totalProviders: number;
  activeProviders: number;
  pendingProviders: number;
  totalBookings: number;
  grossVolumeCents: number;
  platformRevenueCents: number;
  openReports: number;
  platformFeePercent: number;
  providerAutoApprove: boolean;
  paymentGateway: string;
};

type UniversityRow = { id: string; shortName: string; providerCount: number; isActive: boolean };

export default async function AdminOverviewPage() {
  const [stats, campus, universities] = await Promise.all([
    apiGet<Overview>("/api/admin/overview"),
    apiGet<CampusOverview>("/api/stats/campus"),
    apiGet<UniversityRow[]>("/api/admin/universities"),
  ]);

  const topCampuses = [...universities]
    .sort((a, b) => b.providerCount - a.providerCount)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        showDate
        title="Platform overview"
        subtitle="Everything happening across every campus."
        actions={
          <Badge tone={stats.paymentGateway === "STRIPE" ? "success" : "warning"}>
            {stats.paymentGateway === "STRIPE" ? "Stripe live" : "Mock payments"}
          </Badge>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption="Gross booking volume"
          headline={formatCents(stats.grossVolumeCents)}
          bars={
            campus.topCategories.length > 0
              ? campus.topCategories.slice(0, 4).map((entry, index) => ({
                  label: entry.name.split(" ")[0],
                  value: Number(entry.count),
                  highlight: index === 0,
                }))
              : [{ label: "Quiet", value: 1, highlight: true }]
          }
          footer={`Platform revenue: ${formatCents(stats.platformRevenueCents)} at ${stats.platformFeePercent}%`}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Open reports"
            value={stats.openReports}
            icon="flag"
            hint={stats.openReports > 0 ? "Needs a look" : "Queue is clear"}
            href="/admin/reports"
          />
          <StatCard
            label="Providers awaiting approval"
            value={stats.pendingProviders}
            icon="briefcase"
            hint={stats.providerAutoApprove ? "Auto-approve is on" : "Manual review is on"}
            href="/admin/providers"
          />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} icon="users" href="/admin/users" />
        <StatCard
          label="Active providers"
          value={stats.activeProviders}
          icon="briefcase"
          hint={`${stats.totalProviders} total`}
          href="/admin/providers"
        />
        <StatCard
          label="Bookings"
          value={stats.totalBookings}
          icon="calendar"
          href="/admin/bookings"
        />
        <StatCard
          label="Platform revenue"
          value={formatCents(stats.platformRevenueCents)}
          icon="money"
        />
      </div>

      <section>
        <SectionHeading
          title="Campuses by supply"
          subtitle="Where providers actually are"
          action={
            <Link
              href="/admin/universities"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Manage campuses
            </Link>
          }
        />
        <div className="card divide-y divide-line overflow-hidden">
          {topCampuses.map((university) => (
            <div key={university.id} className="flex items-center gap-3 px-4 py-3">
              <Icon name="pin" size={16} className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {university.shortName}
              </span>
              {!university.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
              <span className="text-sm font-bold text-ink">{university.providerCount}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
