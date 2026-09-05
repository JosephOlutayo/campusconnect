"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Form";

/**
 * Requests a move to a new address.
 *
 * Nothing changes when this is submitted — the account moves only when the
 * link sent to the new address is followed, so a typo cannot lock anyone out
 * of their own account.
 */
export function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmail, password }),
      });
      const payload = await response.json();

      if (!payload.ok) {
        setError(payload.error ?? "Could not start the change.");
        setLoading(false);
        return;
      }
      setSent(typeof payload.data === "string" ? payload.data : "Check your inbox.");
      setNewEmail("");
      setPassword("");
    } catch {
      setError("Could not reach the server.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <section className="card p-5">
        <h2 className="text-base font-semibold text-ink">Change your email</h2>
        <p className="mt-2 text-sm text-ink-muted">{sent}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Until then you still sign in with <span className="font-medium">{currentEmail}</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Change your email</h2>
          <p className="mt-1 text-sm text-ink-muted">
            You sign in with this address, and a campus one earns the verified badge.
          </p>
        </div>
        {!open ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <TextField
            label="New email"
            name="newEmail"
            type="email"
            required
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="you@university.edu"
            hint="We send a link there. Nothing changes until you follow it."
          />
          <TextField
            label="Current password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
          {error ? <FormError>{error}</FormError> : null}
          <div className="flex gap-2">
            <Button type="submit" loading={loading}>
              Send the link
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
