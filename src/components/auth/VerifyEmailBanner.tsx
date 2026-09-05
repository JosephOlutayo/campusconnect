"use client";

import { useState } from "react";

/**
 * Shown to signed-in people who have not confirmed their address yet.
 *
 * Without this, the badge simply never appears and there is nothing on screen
 * explaining what is missing or how to fix it.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const resend = async () => {
    setState("sending");
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const payload = await response.json();
      if (!payload.ok) {
        setState("error");
        setMessage(payload.error ?? "Could not send the email.");
        return;
      }
      setState("sent");
      setMessage(typeof payload.data === "string" ? payload.data : "Check your inbox.");
    } catch {
      setState("error");
      setMessage("Could not reach the server.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span aria-hidden>✉️</span>
      <p className="text-amber-900">
        {state === "sent" ? (
          message
        ) : (
          <>
            Confirm <span className="font-semibold">{email}</span> to get your verified
            student badge.
          </>
        )}
      </p>
      {state !== "sent" ? (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="font-semibold text-amber-900 underline underline-offset-2 disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Resend the link"}
        </button>
      ) : null}
      {state === "error" ? <span className="text-danger">{message}</span> : null}
    </div>
  );
}
