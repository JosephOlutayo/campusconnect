"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, Select, TextField } from "@/components/ui/Form";

type University = { id: string; name: string; shortName: string };

export function SignupForm({ universities }: { universities: University[] }) {
  const router = useRouter();
  const [intent, setIntent] = useState<"STUDENT" | "PROVIDER">("STUDENT");
  const [form, setForm] = useState({ name: "", email: "", password: "", universityId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, intent }),
    });
    const payload = await response.json();

    if (!payload.ok) {
      setError(payload.error ?? "Could not create your account.");
      setLoading(false);
      return;
    }

    router.push(payload.data.next);
    router.refresh();
  };

  return (
    <>
      <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Sign in
        </Link>
      </p>

      {/* Intent only changes where we land after signup — both paths create the
          same account, so nobody is locked out of becoming a provider later. */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-surface-sunken p-1">
        {(
          [
            { value: "STUDENT", label: "I need a service" },
            { value: "PROVIDER", label: "I offer a service" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setIntent(option.value)}
            aria-pressed={intent === option.value}
            className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
              intent === option.value
                ? "bg-surface text-ink shadow-[var(--shadow-soft)]"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <FormError>{error}</FormError>

        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={update("name")}
          placeholder="Maya Thompson"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update("email")}
          placeholder="you@university.edu"
          hint="Use your campus email to get the verified student badge."
        />
        <Select
          label="University"
          name="universityId"
          required
          value={form.universityId}
          onChange={update("universityId")}
        >
          <option value="">Select your university</option>
          {universities.map((university) => (
            <option key={university.id} value={university.id}>
              {university.name}
            </option>
          ))}
        </Select>
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={update("password")}
          placeholder="At least 8 characters"
        />

        <Button type="submit" loading={loading} size="lg" className="w-full">
          {intent === "PROVIDER" ? "Continue to set up your business" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-ink-muted">
        By creating an account you agree to our{" "}
        <Link href="/legal/terms" className="underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </>
  );
}
