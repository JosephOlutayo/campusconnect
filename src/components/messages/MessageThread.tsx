"use client";

import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { SeedImage } from "@/components/ui/SeedImage";
import { formatTimeAgo } from "@/lib/time";

type Message = {
  id: string;
  body: string;
  senderId: string;
  imageSeed: string | null;
  createdAt: string;
};

type Props = {
  conversationId: string;
  viewerId: string;
  counterpart: { name: string; avatarSeed: string };
  initialMessages: Message[];
};

/**
 * Polls for new messages while the tab is visible.
 *
 * Polling is the honest MVP answer: no WebSocket infrastructure to run, and at
 * campus scale a 6-second poll is cheap. Swapping in SSE or Pusher later means
 * replacing this one effect.
 */
export function MessageThread({
  conversationId,
  viewerId,
  counterpart,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (document.hidden) return;
      const last = messages[messages.length - 1];
      const query = last ? `?after=${encodeURIComponent(last.createdAt)}` : "";
      try {
        const response = await fetch(`/api/conversations/${conversationId}/messages${query}`);
        const payload = await response.json();
        if (!cancelled && payload.ok && payload.data.messages.length > 0) {
          setMessages((current) => {
            const seen = new Set(current.map((message) => message.id));
            const fresh = (payload.data.messages as Message[]).filter(
              (message) => !seen.has(message.id),
            );
            return fresh.length > 0 ? [...current, ...fresh] : current;
          });
        }
      } catch {
        /* offline — try again on the next tick */
      }
    };

    const timer = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationId, messages]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft("");

    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const payload = await response.json();

    setSending(false);
    if (!payload.ok) {
      // Give the text back rather than silently losing it.
      setDraft(body);
      return;
    }

    setMessages((current) => [
      ...current,
      { ...payload.data.message, createdAt: payload.data.message.createdAt },
    ]);
  };

  return (
    <div className="card flex h-[calc(100dvh-13rem)] flex-col overflow-hidden md:h-[calc(100dvh-11rem)]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-muted p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            Say hello — ask about availability or what to bring.
          </p>
        ) : null}

        {messages.map((message) => {
          const mine = message.senderId === viewerId;
          return (
            <div key={message.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine ? (
                <Avatar seed={counterpart.avatarSeed} name={counterpart.name} size="xs" />
              ) : null}
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                    mine
                      ? "rounded-br-md bg-accent text-white"
                      : "rounded-bl-md border border-line bg-surface text-ink"
                  }`}
                >
                  {message.imageSeed ? (
                    <SeedImage
                      seed={message.imageSeed}
                      alt="Shared photo"
                      className="mb-2 aspect-square w-40 rounded-xl"
                    />
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
                <span className="mt-1 px-1 text-[11px] text-ink-muted">
                  {formatTimeAgo(new Date(message.createdAt))}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline — the convention everyone
            // already has muscle memory for.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(event as unknown as React.FormEvent);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={`Message ${counterpart.name}…`}
          aria-label="Message"
          className="field max-h-32 min-h-11 resize-none py-2.5"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}
