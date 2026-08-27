import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notifications";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  // Opening the page is the read receipt. Done after the read so the "new"
  // styling still shows on this render.
  await markNotificationsRead(user.id);

  return (
    <>
      <PageHeader title="Notifications" subtitle="Bookings, messages and reviews." />

      {notifications.length === 0 ? (
        <EmptyState icon="🔔" title="Nothing here yet" description="We will let you know when something happens." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {notifications.map((notification) => {
            const body = (
              <div className="flex gap-3.5 p-4">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    notification.readAt ? "bg-surface-sunken text-ink-muted" : "bg-accent-soft text-accent"
                  }`}
                >
                  <Icon name={ICONS[notification.type] ?? "bell"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">{notification.title}</p>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatTimeAgo(notification.createdAt)}
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
