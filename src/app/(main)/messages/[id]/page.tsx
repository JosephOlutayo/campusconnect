import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { apiGetOptional, apiGetOrNull } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import type { ConversationHeader, Message } from "@/lib/types";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { MessageThread } from "@/components/messages/MessageThread";
import { ReportButton } from "@/components/providers/ReportButton";

export const metadata: Metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const { data: header } = await apiGetOptional<ConversationHeader>(`/api/conversations/${id}`);
  if (!header) notFound();

  const thread = await apiGetOrNull<{ messages: Message[]; viewerId: string }>(
    `/api/conversations/${id}/messages`,
  );

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
        <Avatar seed={header.counterpartAvatarSeed} name={header.counterpartName} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-ink">{header.counterpartName}</h1>
          {header.viewerIsCustomer ? (
            <Link
              href={`/providers/${header.providerId}`}
              className="text-xs font-semibold text-accent hover:underline"
            >
              View profile
            </Link>
          ) : (
            <p className="text-xs text-ink-muted">Customer</p>
          )}
        </div>
        <ReportButton targetType="USER" targetId={header.counterpartUserId} label="" />
      </div>

      <MessageThread
        conversationId={id}
        viewerId={user.id}
        counterpart={{
          name: header.counterpartName,
          avatarSeed: header.counterpartAvatarSeed,
        }}
        initialMessages={thread?.messages ?? []}
      />
    </>
  );
}
