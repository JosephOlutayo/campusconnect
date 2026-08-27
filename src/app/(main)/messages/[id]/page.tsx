import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadConversationFor, markThreadRead } from "@/lib/messaging";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { MessageThread } from "@/components/messages/MessageThread";
import { ReportButton } from "@/components/providers/ReportButton";

export const metadata: Metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const thread = await loadConversationFor(id, user.id);
  if (!thread) notFound();

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, body: true, senderId: true, imageSeed: true, createdAt: true },
  });

  await markThreadRead(id, user.id);

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-surface-sunken"
        >
          <Icon name="arrowLeft" size={20} />
        </Link>
        <Avatar
          seed={thread.counterpart.avatarSeed}
          name={thread.counterpart.name}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-ink">{thread.counterpart.name}</h1>
          {thread.isCustomer ? (
            <Link
              href={`/providers/${thread.conversation.provider.id}`}
              className="text-xs font-semibold text-accent hover:underline"
            >
              View profile
            </Link>
          ) : (
            <p className="text-xs text-ink-muted">Customer</p>
          )}
        </div>
        <ReportButton targetType="USER" targetId={thread.counterpart.id} label="" />
      </div>

      <MessageThread
        conversationId={id}
        viewerId={user.id}
        counterpart={{
          name: thread.counterpart.name,
          avatarSeed: thread.counterpart.avatarSeed,
        }}
        initialMessages={messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
