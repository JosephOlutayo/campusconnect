import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const FILTERS = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "all"] as const;

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "OPEN";

  const reports = await prisma.report.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { id: true, name: true, avatarSeed: true } },
      targetUser: {
        select: {
          id: true,
          name: true,
          avatarSeed: true,
          isSuspended: true,
          providerProfile: { select: { id: true, businessName: true } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Every report from students and providers. Act on the account, not just the report."
      />

      <nav className="rail mb-5 -mx-1 flex gap-2 px-1">
        {FILTERS.map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/admin/reports?status=all" : `/admin/reports?status=${option}`}
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

      {reports.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="Nothing to review"
          description="No reports match this filter. Quiet moderation queue is a good sign."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{report.targetType.toLowerCase()}</Badge>
                    <p className="text-sm font-bold text-ink">{report.reason}</p>
                    <Badge
                      tone={
                        report.status === "OPEN"
                          ? "danger"
                          : report.status === "REVIEWING"
                            ? "warning"
                            : "success"
                      }
                    >
                      {report.status.toLowerCase()}
                    </Badge>
                    <span className="text-xs text-ink-muted">
                      {formatTimeAgo(report.createdAt)}
                    </span>
                  </div>

                  {report.details ? (
                    <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2.5 text-sm text-ink-soft">
                      “{report.details}”
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <Avatar
                        seed={report.reporter.avatarSeed}
                        name={report.reporter.name}
                        size="xs"
                      />
                      Reported by {report.reporter.name}
                    </span>
                    {report.targetUser ? (
                      <span className="flex items-center gap-2 text-ink-muted">
                        <Avatar
                          seed={report.targetUser.avatarSeed}
                          name={report.targetUser.name}
                          size="xs"
                        />
                        About{" "}
                        {report.targetUser.providerProfile ? (
                          <Link
                            href={`/providers/${report.targetUser.providerProfile.id}`}
                            className="font-semibold text-accent hover:underline"
                          >
                            {report.targetUser.providerProfile.businessName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-ink">{report.targetUser.name}</span>
                        )}
                        {report.targetUser.isSuspended ? (
                          <Badge tone="danger">already suspended</Badge>
                        ) : null}
                      </span>
                    ) : null}
                  </div>

                  {report.resolutionNote ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      Resolution: {report.resolutionNote}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ActionMenu
                    endpoint={`/api/admin/reports/${report.id}`}
                    actions={[
                      { action: "reviewing", label: "Mark reviewing" },
                      { action: "resolve", label: "Resolve", variant: "success", needsNote: true },
                      { action: "dismiss", label: "Dismiss" },
                    ]}
                  />
                  {report.targetUser && !report.targetUser.isSuspended ? (
                    <ActionMenu
                      endpoint={`/api/admin/users/${report.targetUser.id}`}
                      actions={[
                        {
                          action: "suspend",
                          label: "Suspend account",
                          variant: "danger",
                          needsNote: true,
                        },
                      ]}
                    />
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
