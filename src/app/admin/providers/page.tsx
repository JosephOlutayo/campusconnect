import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu, type Action } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Providers" };
export const dynamic = "force-dynamic";

const FILTERS = ["all", "ACTIVE", "PENDING", "PAUSED", "SUSPENDED", "REJECTED"] as const;

export default async function AdminProvidersPage({ searchParams }: PageProps<"/admin/providers">) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "all";

  const providers = await prisma.providerProfile.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true, avatarSeed: true, isSuspended: true } },
      university: { select: { shortName: true } },
      _count: { select: { services: true, appointments: true, reviews: true } },
    },
  });

  const earnings = await prisma.appointment.groupBy({
    by: ["providerId"],
    where: { status: "COMPLETED", providerId: { in: providers.map((p) => p.id) } },
    _sum: { priceCents: true, platformFeeCents: true },
  });
  const earningsById = new Map(earnings.map((row) => [row.providerId, row]));

  return (
    <>
      <PageHeader title="Providers" subtitle={`${providers.length} shown`} />

      <nav className="rail mb-5 -mx-1 flex gap-2 px-1">
        {FILTERS.map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/admin/providers" : `/admin/providers?status=${option}`}
            aria-current={status === option ? "page" : undefined}
            className={`pill shrink-0 border capitalize transition-colors ${
              status === option
                ? "border-accent bg-accent text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option === "all" ? "All" : option.toLowerCase()}
          </Link>
        ))}
      </nav>

      {providers.length === 0 ? (
        <EmptyState icon="💼" title="No providers match this filter" />
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const money = earningsById.get(provider.id);
            const actions: Action[] = [];

            if (provider.status === "PENDING") {
              actions.push({ action: "approve", label: "Approve", variant: "success" });
              actions.push({ action: "reject", label: "Reject", variant: "danger", needsNote: true });
            } else if (provider.status === "SUSPENDED" || provider.status === "REJECTED") {
              actions.push({ action: "reinstate", label: "Reinstate", variant: "success" });
            } else {
              actions.push({
                action: "suspend",
                label: "Suspend",
                variant: "danger",
                confirm: `Suspend ${provider.businessName}? Their listing disappears from search immediately.`,
              });
            }

            actions.push(
              provider.isVerified
                ? { action: "unverify", label: "Remove tick" }
                : { action: "verify", label: "Verify" },
            );

            return (
              <article key={provider.id} className="card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <Avatar
                    seed={provider.user.avatarSeed}
                    name={provider.businessName}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/providers/${provider.id}`}
                        className="text-sm font-bold text-ink hover:text-accent"
                      >
                        {provider.businessName}
                      </Link>
                      {provider.isVerified ? <VerifiedBadge label="" /> : null}
                      <Badge
                        tone={
                          provider.status === "ACTIVE"
                            ? "success"
                            : provider.status === "PENDING"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {provider.status.toLowerCase()}
                      </Badge>
                      {provider.user.isSuspended ? (
                        <Badge tone="danger">Account suspended</Badge>
                      ) : null}
                    </div>

                    <p className="mt-0.5 text-xs text-ink-muted">
                      {provider.user.name} · {provider.user.email} · {provider.university.shortName}{" "}
                      · joined {formatDate(provider.createdAt, { month: "short", year: "numeric" })}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <Stars rating={provider.ratingAvg} count={provider.ratingCount} size="sm" />
                      <span>{provider._count.services} services</span>
                      <span>{provider._count.appointments} bookings</span>
                      <span>{provider.locationLabel}</span>
                    </div>
                  </div>

                  <div className="shrink-0 lg:text-right">
                    <p className="text-sm font-bold text-ink">
                      {formatCents(money?._sum.priceCents ?? 0)} gross
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatCents(money?._sum.platformFeeCents ?? 0)} in fees
                    </p>
                    <div className="mt-3 lg:flex lg:justify-end">
                      <ActionMenu
                        endpoint={`/api/admin/providers/${provider.id}`}
                        actions={actions}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
