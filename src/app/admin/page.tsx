import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getPlatformFeePercent } from "@/lib/settings";
import { formatCents } from "@/lib/money";
import { addDays, startOfDay, startOfMonth } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Admin overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const monthStart = startOfMonth(new Date());
  const weekAgo = addDays(startOfDay(new Date()), -7);

  const [
    users,
    providers,
    pendingProviders,
    bookings,
    gross,
    openReports,
    newUsers,
    newProviders,
    universities,
    feePercent,
    topCampuses,
    recentSignups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.providerProfile.count({ where: { status: "ACTIVE" } }),
    prisma.providerProfile.count({ where: { status: "PENDING" } }),
    prisma.appointment.count(),
    prisma.appointment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { priceCents: true, platformFeeCents: true },
    }),
    prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.providerProfile.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.university.count({ where: { isActive: true } }),
    getPlatformFeePercent(),
    prisma.providerProfile.groupBy({
      by: ["universityId"],
      _count: { _all: true },
      orderBy: { _count: { universityId: "desc" } },
      take: 5,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        email: true,
        avatarSeed: true,
        role: true,
        createdAt: true,
        university: { select: { shortName: true } },
      },
    }),
  ]);

  const campusNames = await prisma.university.findMany({
    where: { id: { in: topCampuses.map((row) => row.universityId) } },
    select: { id: true, shortName: true },
  });
  const nameById = new Map(campusNames.map((row) => [row.id, row.shortName]));

  const monthlyBookings = await prisma.appointment.count({
    where: { createdAt: { gte: monthStart } },
  });

  const popularServices = await prisma.service.findMany({
    orderBy: { bookingCount: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      bookingCount: true,
      priceCents: true,
      provider: { select: { businessName: true } },
      category: { select: { name: true, icon: true } },
    },
  });

  return (
    <>
      <PageHeader
        showDate
        title="Platform overview"
        subtitle={`${universities} campuses live · ${feePercent}% marketplace fee`}
        actions={
          openReports > 0 ? (
            <Link
              href="/admin/reports"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-danger-soft px-4 text-sm font-semibold text-danger"
            >
              <Icon name="flag" size={16} />
              {openReports} open report{openReports === 1 ? "" : "s"}
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption="Providers by campus"
          headline={String(providers)}
          delta={
            newProviders > 0 ? { value: `${newProviders} this week`, positive: true } : undefined
          }
          bars={topCampuses.map((row, index) => ({
            label: nameById.get(row.universityId) ?? "—",
            value: row._count._all,
            highlight: index === 0,
          }))}
          footer={`${monthlyBookings} bookings created this month`}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Gross booking volume"
            value={formatCents(gross._sum.priceCents ?? 0)}
            icon="money"
            hint="Completed bookings, all time"
          />
          <StatCard
            label="Platform revenue"
            value={formatCents(gross._sum.platformFeeCents ?? 0)}
            icon="chart"
            hint={`at ${feePercent}% of each booking`}
          />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={users}
          icon="users"
          delta={newUsers > 0 ? { value: `${newUsers} this week`, positive: true } : undefined}
          href="/admin/users"
        />
        <StatCard label="Active providers" value={providers} icon="briefcase" href="/admin/providers" />
        <StatCard
          label="Awaiting approval"
          value={pendingProviders}
          icon="clock"
          href="/admin/providers?status=PENDING"
        />
        <StatCard label="Total bookings" value={bookings} icon="calendar" href="/admin/bookings" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title="Most booked services" />
          <div className="card divide-y divide-line overflow-hidden">
            {popularServices.map((service) => (
              <div key={service.id} className="flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-lg">
                  {service.category.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{service.title}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {service.provider.businessName} · {service.category.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-ink">{service.bookingCount}</p>
                  <p className="text-xs text-ink-muted">{formatCents(service.priceCents)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title="Newest accounts"
            action={
              <Link href="/admin/users" className="text-sm font-semibold text-accent hover:underline">
                All users
              </Link>
            }
          />
          <div className="card divide-y divide-line overflow-hidden">
            {recentSignups.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-4">
                <Avatar seed={user.avatarSeed} name={user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-xs text-ink-muted">{user.email}</p>
                </div>
                <Badge tone={user.role === "ADMIN" ? "dark" : user.role === "PROVIDER" ? "accent" : "neutral"}>
                  {user.role.toLowerCase()}
                </Badge>
                <span className="shrink-0 text-xs text-ink-muted">
                  {user.university?.shortName ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
