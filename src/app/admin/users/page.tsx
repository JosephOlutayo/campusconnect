import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "STUDENT", label: "Students" },
  { value: "PROVIDER", label: "Providers" },
  { value: "ADMIN", label: "Admins" },
  { value: "suspended", label: "Suspended" },
] as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const query = await searchParams;
  const filter = typeof query.role === "string" ? query.role : "all";
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const me = await getSessionUser();

  const where = {
    ...(filter === "suspended"
      ? { isSuspended: true }
      : filter !== "all"
        ? { role: filter }
        : {}),
    ...(search
      ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      university: { select: { shortName: true } },
      providerProfile: { select: { id: true, businessName: true, status: true } },
      _count: { select: { appointments: true, reportsAgainst: true } },
    },
  });

  return (
    <>
      <PageHeader title="Users" subtitle={`${users.length} shown`} />

      <form className="mb-4 flex gap-2" action="/admin/users">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name or email"
          aria-label="Search users"
          className="field max-w-sm"
        />
        {filter !== "all" ? <input type="hidden" name="role" value={filter} /> : null}
        <button
          type="submit"
          className="rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-soft hover:bg-surface-muted"
        >
          Search
        </button>
      </form>

      <nav className="rail mb-5 -mx-1 flex gap-2 px-1">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "all" ? "/admin/users" : `/admin/users?role=${option.value}`}
            aria-current={filter === option.value ? "page" : undefined}
            className={`pill shrink-0 border transition-colors ${
              filter === option.value
                ? "border-accent bg-accent text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {users.length === 0 ? (
        <EmptyState icon="👥" title="No users match" />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <article key={user.id} className="card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Avatar seed={user.avatarSeed} name={user.name} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-ink">{user.name}</p>
                    <Badge
                      tone={
                        user.role === "ADMIN" ? "dark" : user.role === "PROVIDER" ? "accent" : "neutral"
                      }
                    >
                      {user.role.toLowerCase()}
                    </Badge>
                    {user.isSuspended ? <Badge tone="danger">Suspended</Badge> : null}
                    {user.studentVerifiedAt ? <Badge tone="success">Verified student</Badge> : null}
                    {user._count.reportsAgainst > 0 ? (
                      <Badge tone="warning">{user._count.reportsAgainst} report(s)</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {user.email} · {user.university?.shortName ?? "no campus"} · joined{" "}
                    {formatDate(user.createdAt, { month: "short", day: "numeric", year: "numeric" })}{" "}
                    · {user._count.appointments} booking(s)
                  </p>
                  {user.providerProfile ? (
                    <Link
                      href={`/providers/${user.providerProfile.id}`}
                      className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                    >
                      {user.providerProfile.businessName} ({user.providerProfile.status.toLowerCase()})
                    </Link>
                  ) : null}
                  {user.suspendedNote ? (
                    <p className="mt-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                      {user.suspendedNote}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {user.id === me?.id ? (
                    <span className="text-xs text-ink-faint">That is you</span>
                  ) : (
                    <ActionMenu
                      endpoint={`/api/admin/users/${user.id}`}
                      actions={
                        user.isSuspended
                          ? [{ action: "reinstate", label: "Reinstate", variant: "success" }]
                          : [
                              {
                                action: "suspend",
                                label: "Suspend",
                                variant: "danger",
                                needsNote: true,
                              },
                              user.role === "ADMIN"
                                ? { action: "revoke_admin", label: "Revoke admin" }
                                : { action: "make_admin", label: "Make admin" },
                            ]
                      }
                    />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
