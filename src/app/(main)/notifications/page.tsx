import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import { formatTimeAgo } from "@/lib/time";
import type { Notification } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkNotificationsRead } from "@/components/notifications/MarkNotificationsRead";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const ICONS: Record<string, IconName> = {
  BOOKING_CREATED: "calendar",
  BOOKING_CONFIRMED: "check",
  BOOKING_DECLINED: "ban",
  BOOKING_CANCELLED: "ban",
  BOOKING_RESCHEDULED: "clock",
  BOOKING_REMINDER: "bell",
  BOOKING_COMPLETED: "star",
  MESSAGE_RECEIVED: "chat",
  REVIEW_RECEIVED: "star",
  REVIEW_REPLY: "chat",
  PROVIDER_APPROVED: "check",
  PROVIDER_REJECTED: "ban",
  PAYOUT_PAID: "money",
};

export default async function NotificationsPage() {
  await requireUser();

  const payload = await apiGet<{ notifications: Notification[]; unread: number }>(
    "/api/notifications",
  );

  return (
    <>
      <PageHeader title="Notifications" subtitle="Bookings, messages and reviews." />

      {/* Opening the page is the read receipt, but marking read is a write, so
          it happens from the client after this render — that way the "new"
          styling is still visible on the notifications you just arrived to. */}
      <MarkNotificationsRead unread={payload.unread} />

      {payload.notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Nothing here yet"
          description="We will let you know when something happens."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {payload.notifications.map((notification) => {
            const body = (
              <div className="flex gap-3.5 p-4">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    notification.readAt
                      ? "bg-surface-sunken text-ink-muted"
                      : "bg-accent-soft text-accent"
                  }`}
                >
                  <Icon name={ICONS[notification.type] ?? "bell"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">{notification.title}</p>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatTimeAgo(new Date(notification.createdAt))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-soft">{notification.body}</p>
                </div>
                {!notification.readAt ? (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
                ) : null}
              </div>
            );

            return notification.href ? (
              <Link
                key={notification.id}
                href={notification.href}
                className="block transition-colors hover:bg-surface-muted"
              >
                {body}
              </Link>
            ) : (
              <div key={notification.id}>{body}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
