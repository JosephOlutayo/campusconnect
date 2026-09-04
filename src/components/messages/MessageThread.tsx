"use client";

import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { SeedImage } from "@/components/ui/SeedImage";
import { formatTimeAgo } from "@/lib/time";
import type { Message } from "@/lib/types";

type Props = {
  conversationId: string;
  viewerId: string;
  counterpart: { name: string; avatarSeed: string };
  initialMessages: Message[];
};

/** What the server pushes over /topic/conversations/{id}. */
type Broadcast = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

/**
 * The WebSocket connects straight to the Java server rather than through the
 * Next.js proxy — proxying a WebSocket upgrade through a route handler is not
 * something Next.js does, and the STOMP endpoint allows this origin by CORS.
 */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080/ws";

export function MessageThread({
  conversationId,
  viewerId,
  counterpart,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /**
   * Live updates over STOMP.
   *
   * Messages still POST over REST — that is the path that persists them and
   * returns errors a user can act on. The socket is purely for hearing about
   * the *other* person's messages without polling. If it fails to connect the
   * thread degrades to "refresh to see new messages" rather than breaking.
   */
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 4000,
      onConnect: () => {
        setLive(true);
        client.subscribe(`/topic/conversations/${conversationId}`, (frame: IMessage) => {
          try {
            const incoming = JSON.parse(frame.body) as Broadcast;
            setMessages((current) => {
              // The sender already appended their own message optimistically.
              if (current.some((message) => message.id === incoming.id)) return current;
              return [
                ...current,
                {
                  id: incoming.id,
                  conversationId: incoming.conversationId,
                  senderId: incoming.senderId,
                  senderName: incoming.senderName,
                  body: incoming.body,
                  imageSeed: null,
                  createdAt: incoming.createdAt,
                  readAt: null,
                },
              ];
            });
          } catch {
            /* malformed frame — ignore rather than tear down the socket */
          }
        });
      },
      onWebSocketClose: () => setLive(false),
      onStompError: () => setLive(false),
    });

    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [conversationId]);

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

    setMessages((current) =>
      current.some((message) => message.id === payload.data.id)
        ? current
        : [...current, payload.data as Message],
    );
  };

  return (
    <div className="card flex h-[calc(100dvh-13rem)] flex-col overflow-hidden md:h-[calc(100dvh-11rem)]">
      <div className="flex items-center justify-end border-b border-line px-4 py-1.5">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
            live ? "text-success" : "text-ink-faint"
          }`}
          title={live ? "Live updates on" : "Reconnecting — refresh to see new messages"}
        >
          <span
            className={`size-1.5 rounded-full ${live ? "bg-success" : "bg-ink-faint"}`}
            aria-hidden
          />
          {live ? "Live" : "Offline"}
        </span>
      </div>

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
              <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
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
              void send(event as unknown as React.FormEvent);
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
