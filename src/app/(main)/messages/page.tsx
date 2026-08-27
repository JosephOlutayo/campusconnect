import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listConversations } from "@/lib/messaging";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser();
  const conversations = await listConversations(user.id);

  return (
    <>
      <PageHeader title="Messages" subtitle="Everything stays in the app — no phone numbers shared." />

      {conversations.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No conversations yet"
          description="Message a provider from their profile to ask about availability, pricing or what to bring."
          action={<ButtonLink href="/explore">Find a provider</ButtonLink>}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/messages/${conversation.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
            >
              <Avatar seed={conversation.avatarSeed} name={conversation.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={`truncate text-sm ${conversation.unread > 0 ? "font-bold text-ink" : "font-semibold text-ink"}`}
                  >
                    {conversation.name}
                  </p>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatTimeAgo(conversation.lastMessageAt)}
                  </span>
                </div>
                <p
                  className={`mt-0.5 truncate text-[13px] ${conversation.unread > 0 ? "font-medium text-ink-soft" : "text-ink-muted"}`}
                >
                  {conversation.lastMessage || "No messages yet"}
                </p>
              </div>
              {conversation.unread > 0 ? (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {conversation.unread}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
