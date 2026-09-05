"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/Button";

type State = "working" | "done" | "failed";

/**
 * Redeems the link from a verification email.
 *
 * The request fires from the browser rather than while rendering on the server,
 * because university mail systems follow links in messages to scan them. A
 * server-side redemption would be spent by the scanner before the student ever
 * clicked, and they would arrive to "already used". Scanners do not run
 * JavaScript, so doing it here survives them.
 */
export function VerifyEmail({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>(token ? "working" : "failed");
  const [message, setMessage] = useState(
    token ? "" : "That link is missing its code. Try opening it again from your email.",
  );
  // React runs effects twice in development; the token is single-use, so a
  // second call would report it as already spent.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json();

        if (!payload.ok) {
          setState("failed");
          setMessage(payload.error ?? "We could not confirm that link.");
          return;
        }

        setState("done");
        setMessage(
          payload.data?.studentVerified
            ? "Your campus email is confirmed. You have the verified student badge."
            : "Your email is confirmed.",
        );
        router.refresh();
      } catch {
        setState("failed");
        setMessage("We could not reach the server. Please try again.");
      }
    })();
  }, [token, router]);

  return (
    <div className="text-center">
      {state === "working" ? (
        <>
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
            aria-hidden
          />
          <h1 className="mt-5 text-xl font-bold text-ink">Confirming your email…</h1>
        </>
      ) : null}

      {state === "done" ? (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-2xl">
            ✅
          </div>
          <h1 className="mt-5 text-xl font-bold text-ink">You are all set</h1>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <ButtonLink href="/" className="mt-6 w-full" size="lg">
            Start exploring
          </ButtonLink>
        </>
      ) : null}

      {state === "failed" ? (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-2xl">
            ✉️
          </div>
          <h1 className="mt-5 text-xl font-bold text-ink">That link did not work</h1>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <p className="mt-4 text-sm text-ink-muted">
            Sign in and we can send you a fresh one.
          </p>
          <ButtonLink href="/login" className="mt-6 w-full" size="lg">
            Sign in
          </ButtonLink>
        </>
      ) : null}
    </div>
  );
}
