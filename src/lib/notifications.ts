import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/lib/constants";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
};

/**
 * Single fan-out point for every user-facing alert.
 *
 * Today it only writes the in-app row. Email/SMS/push slot in here: add a
 * channel dispatch after the insert (queue a job per channel keyed on the
 * notification id) and no caller has to change.
 */
export async function notify(input: NotifyInput | NotifyInput[]): Promise<void> {
  const items = Array.isArray(input) ? input : [input];
  if (items.length === 0) return;

  await prisma.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href ?? null,
    })),
  });

  // await Promise.all(items.map(dispatchEmail))  <- future channel
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function unreadMessageCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: {
        OR: [{ customerId: userId }, { provider: { userId } }],
      },
    },
  });
}
