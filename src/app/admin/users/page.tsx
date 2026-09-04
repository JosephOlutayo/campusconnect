import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarSeed: string;
  suspended: boolean;
  studentVerified: boolean;
  university: string;
  createdAt: string;
};

const ROLE_TABS = ["all", "STUDENT", "PROVIDER", "ADMIN"] as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const query = await searchParams;
  const role = typeof query.role === "string" ? query.role : "all";
  const q = typeof query.q === "string" ? query.q : "";

  const params = new URLSearchParams();
  if (role !== "all") params.set("role", role);
  if (q) params.set("q", q);

  const users = await apiGet<UserRow[]>(`/api/admin/users?${params.toString()}`);

  return (
    <>
      <PageHeader title="Users" subtitle={`${users.length} accounts`} />

      <div className="rail mb-5 -mx-1 flex gap-2 px-1">
        {ROLE_TABS.map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/admin/users" : `/admin/users?role=${option}`}
            className={`pill shrink-0 border capitalize transition-colors ${
              role === option
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option === "all" ? "All" : option.toLowerCase()}
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState icon="👥" title="No users match" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar seed={user.avatarSeed} name={user.name} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <Badge tone={user.role === "ADMIN" ? "dark" : "neutral"}>
                    {user.role.toLowerCase()}
                  </Badge>
                  {user.studentVerified ? <Badge tone="success">Verified</Badge> : null}
                  {user.suspended ? <Badge tone="danger">Suspended</Badge> : null}
                </div>
                <p className="truncate text-xs text-ink-muted">
                  {user.email}
                  {user.university ? ` · ${user.university}` : ""} · joined{" "}
                  {formatDate(new Date(user.createdAt))}
                </p>
              </div>

              <ActionMenu
                endpoint={`/api/admin/users/${user.id}`}
                actions={
                  user.suspended
                    ? [{ action: "reinstate", label: "Reinstate account", variant: "success" }]
                    : [
                        { action: "suspend", label: "Suspend account", variant: "danger", needsNote: true },
                        user.role === "ADMIN"
                          ? { action: "revoke_admin", label: "Revoke admin" }
                          : { action: "make_admin", label: "Make admin" },
                      ]
                }
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
