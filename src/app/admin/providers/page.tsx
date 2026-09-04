import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Providers" };
export const dynamic = "force-dynamic";

type ProviderRow = {
  id: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  avatarSeed: string;
  university: string;
  status: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedBookings: number;
};

const TABS = ["all", "ACTIVE", "PENDING", "PAUSED", "SUSPENDED", "REJECTED"] as const;

export default async function AdminProvidersPage({ searchParams }: PageProps<"/admin/providers">) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "all";

  const providers = await apiGet<ProviderRow[]>(`/api/admin/providers?status=${status}`);

  return (
    <>
      <PageHeader title="Providers" subtitle={`${providers.length} listings`} />

      <div className="rail mb-5 -mx-1 flex gap-2 px-1">
        {TABS.map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/admin/providers" : `/admin/providers?status=${option}`}
            className={`pill shrink-0 border capitalize transition-colors ${
              status === option
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option === "all" ? "All" : option.toLowerCase()}
          </Link>
        ))}
      </div>

      {providers.length === 0 ? (
        <EmptyState icon="💼" title="No providers match that filter" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {providers.map((provider) => (
            <div key={provider.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar seed={provider.avatarSeed} name={provider.businessName} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/providers/${provider.id}`}
                    className="truncate text-sm font-semibold text-ink hover:text-accent"
                  >
                    {provider.businessName}
                  </Link>
                  {provider.verified ? <VerifiedBadge /> : null}
                  <Badge
                    tone={
                      provider.status === "ACTIVE"
                        ? "success"
                        : provider.status === "PENDING"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {provider.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="truncate text-xs text-ink-muted">
                  {provider.ownerName} · {provider.ownerEmail} · {provider.university}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <Stars rating={provider.ratingAvg} count={provider.ratingCount} size="sm" />
                  <span className="text-xs text-ink-muted">
                    {provider.completedBookings} completed
                  </span>
                </div>
              </div>

              <ActionMenu
                endpoint={`/api/admin/providers/${provider.id}`}
                actions={[
                  ...(provider.status === "PENDING"
                    ? [
                        { action: "approve", label: "Approve listing", variant: "success" as const },
                        {
                          action: "reject",
                          label: "Reject listing",
                          variant: "danger" as const,
                          needsNote: true,
                        },
                      ]
                    : []),
                  ...(provider.status === "SUSPENDED"
                    ? [{ action: "reinstate", label: "Reinstate", variant: "success" as const }]
                    : [{ action: "suspend", label: "Suspend listing", variant: "danger" as const }]),
                  provider.verified
                    ? { action: "unverify", label: "Remove verified badge" }
                    : { action: "verify", label: "Grant verified badge" },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
