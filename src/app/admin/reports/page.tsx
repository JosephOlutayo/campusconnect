import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  reporterName: string;
  targetUserId: string;
  createdAt: string;
};

const TABS = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "all"] as const;

/** Reported things live in different places, so the link depends on the type. */
function targetHref(report: ReportRow): string | null {
  if (report.targetType === "PROVIDER") return `/providers/${report.targetId}`;
  if (report.targetType === "USER") return "/admin/users";
  return null;
}

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "OPEN";

  const reports = await apiGet<ReportRow[]>(`/api/admin/reports?status=${status}`);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Every report a student filed. Resolve or dismiss once you have acted."
      />

      <div className="rail mb-5 -mx-1 flex gap-2 px-1">
        {TABS.map((option) => (
          <Link
            key={option}
            href={`/admin/reports?status=${option}`}
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

      {reports.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="Queue is clear"
          description="Nothing needs your attention in this bucket."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const href = targetHref(report);
            return (
              <article key={report.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink">{report.reason}</p>
                      <Badge tone="neutral">{report.targetType.toLowerCase()}</Badge>
                      <Badge
                        tone={
                          report.status === "OPEN"
                            ? "warning"
                            : report.status === "RESOLVED"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {report.status.toLowerCase()}
                      </Badge>
                    </div>

                    <p className="mt-1 text-xs text-ink-muted">
                      Reported by {report.reporterName} ·{" "}
                      {formatTimeAgo(new Date(report.createdAt))}
                    </p>

                    {report.details ? (
                      <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-[13px] text-ink-soft">
                        {report.details}
                      </p>
                    ) : null}

                    {href ? (
                      <Link
                        href={href}
                        className="mt-2 inline-flex text-xs font-semibold text-accent hover:underline"
                      >
                        View what was reported
                      </Link>
                    ) : null}
                  </div>

                  <ActionMenu
                    endpoint={`/api/admin/reports/${report.id}`}
                    actions={[
                      { action: "reviewing", label: "Mark as reviewing" },
                      { action: "resolve", label: "Resolve", variant: "success", needsNote: true },
                      { action: "dismiss", label: "Dismiss", variant: "danger" },
                    ]}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
