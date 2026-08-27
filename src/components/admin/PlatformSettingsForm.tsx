"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, FormSection, TextField, Hint } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatCents } from "@/lib/money";

type Props = {
  platformFeePercent: number;
  providerAutoApprove: boolean;
};

export function PlatformSettingsForm({ platformFeePercent, providerAutoApprove }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [fee, setFee] = useState(String(platformFeePercent));
  const [autoApprove, setAutoApprove] = useState(providerAutoApprove);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platformFeePercent: Number(fee),
        providerAutoApprove: autoApprove,
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not save settings.");
      return;
    }

    toast("Marketplace settings saved.");
    router.refresh();
  };

  const percent = Number(fee) || 0;
  const example = 4000; // a $40 service
  const platformCut = Math.floor((example * percent) / 100);

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <FormError>{error}</FormError>

      <FormSection
        title="Marketplace fee"
        description="The percentage the platform keeps from every completed booking."
      >
        <div>
          <TextField
            label="Fee percentage"
            type="number"
            min={0}
            max={50}
            step="0.5"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
          />
          <Hint>
            Applies to bookings made from now on. Every existing appointment stores its own fee
            snapshot, so past payouts never change.
          </Hint>
        </div>

        <div className="rounded-2xl bg-surface-sunken p-4">
          <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">
            On a {formatCents(example)} service
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Student pays</dt>
              <dd className="font-semibold text-ink">{formatCents(example)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Platform keeps ({percent}%)</dt>
              <dd className="font-semibold text-ink">{formatCents(platformCut)}</dd>
            </div>
            <div className="flex justify-between border-t border-line-strong pt-2">
              <dt className="text-ink-muted">Provider receives</dt>
              <dd className="font-bold text-success">{formatCents(example - platformCut)}</dd>
            </div>
          </dl>
        </div>
      </FormSection>

      <FormSection
        title="Provider approval"
        description="Whether a new provider goes live immediately or waits in a review queue."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              value: true,
              title: "Auto-approve",
              body: "New listings go live instantly. Best while you are still growing supply.",
            },
            {
              value: false,
              title: "Manual review",
              body: "Every new provider lands in the pending queue for a human to approve.",
            },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => setAutoApprove(option.value)}
              aria-pressed={autoApprove === option.value}
              className={`rounded-2xl border p-3.5 text-left transition-all ${
                autoApprove === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <span className="block text-sm font-semibold text-ink">{option.title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{option.body}</span>
            </button>
          ))}
        </div>
      </FormSection>

      <Button type="submit" loading={loading} size="lg">
        Save settings
      </Button>
    </form>
  );
}
