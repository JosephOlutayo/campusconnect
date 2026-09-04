"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Form";

const DEMO_ACCOUNTS = [
  { label: "Student", email: "student@campusconnect.dev", note: "bookings, saves, messages" },
  { label: "Provider", email: "marcus@utdallas.edu", note: "Campus Cuts dashboard" },
  { label: "Admin", email: "admin@campusconnect.dev", note: "moderation console" },
];

export function LoginForm({ showDemoAccounts = false }: { showDemoAccounts?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();

    if (!payload.ok) {
      setError(payload.error ?? "Could not sign you in.");
      setLoading(false);
      return;
    }

    router.push(payload.data.next);
    // Server components cached the signed-out session; force them to re-render.
    router.refresh();
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setError("");
  };

  return (
    <>
      <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          Create an account
        </Link>
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <FormError>{error}</FormError>

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@university.edu"
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Sign in
        </Button>
      </form>

      {showDemoAccounts && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface-muted p-4">
          <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Demo accounts</p>
          <p className="mt-1 text-xs text-ink-muted">
            Tap one to fill the form. Password is <code className="font-semibold">password123</code>.
          </p>
          <div className="mt-3 grid gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemo(account.email)}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-left text-xs transition-colors hover:bg-accent-soft"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{account.label}</span>
                  <span className="block truncate text-ink-muted">{account.note}</span>
                </span>
                <span className="shrink-0 font-semibold text-accent">Use</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
