"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, Select, TextField } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatCents } from "@/lib/money";
import { formatDate, toDateKey, addDays } from "@/lib/time";

type Promotion = {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  redemptions: number;
  maxRedemptions: number | null;
};

export function PromotionManager({ promotions }: { promotions: Promotion[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "PERCENT",
    discountValue: "10",
    startsAt: toDateKey(new Date()),
    endsAt: toDateKey(addDays(new Date(), 30)),
    maxRedemptions: "",
  });

  const create = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/provider/promotions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startsAt: new Date(`${form.startsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not create the promotion.");
      return;
    }

    setOpen(false);
    toast("Promotion is live.");
    router.refresh();
  };

  const deactivate = async (id: string) => {
    await fetch("/api/provider/promotions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast("Promotion stopped.");
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} />
          New promotion
        </Button>
      </div>

      {promotions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface-muted px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">No promotions yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            A first-time discount is the cheapest way to get a new student through the door. They
            almost always come back at full price.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {promotions.map((promotion) => {
            const expired = new Date(promotion.endsAt) < new Date();
            return (
              <article key={promotion.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-feature px-2.5 py-1 font-mono text-sm font-bold text-white">
                        {promotion.code}
                      </span>
                      {!promotion.isActive ? (
                        <Badge tone="neutral">Stopped</Badge>
                      ) : expired ? (
                        <Badge tone="neutral">Expired</Badge>
                      ) : (
                        <Badge tone="success">Live</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium text-ink">{promotion.description}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatDate(new Date(promotion.startsAt))} –{" "}
                      {formatDate(new Date(promotion.endsAt))} · {promotion.redemptions} used
                      {promotion.maxRedemptions ? ` of ${promotion.maxRedemptions}` : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-ink">
                      {promotion.discountType === "PERCENT"
                        ? `${promotion.discountValue}% off`
                        : `${formatCents(promotion.discountValue)} off`}
                    </p>
                    {promotion.isActive && !expired ? (
                      <button
                        onClick={() => deactivate(promotion.id)}
                        className="mt-2 text-xs font-semibold text-danger hover:underline"
                      >
                        Stop promotion
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a promotion"
        description="Students enter the code at checkout."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={create} loading={loading} className="flex-1">
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>

          <TextField
            label="Code"
            hint="Letters and numbers only. Students type this exactly."
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="FIRST10"
            className="font-mono uppercase"
          />
          <TextField
            label="What it is"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="10% off your first booking"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              value={form.discountType}
              onChange={(event) => setForm({ ...form, discountType: event.target.value })}
            >
              <option value="PERCENT">Percentage off</option>
              <option value="AMOUNT">Dollar amount off</option>
            </Select>
            <TextField
              label={form.discountType === "PERCENT" ? "Percent off" : "Dollars off"}
              type="number"
              min={1}
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Starts"
              type="date"
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            />
            <TextField
              label="Ends"
              type="date"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </div>

          <TextField
            label="Redemption limit"
            hint="Optional. Leave blank for unlimited."
            type="number"
            min={1}
            value={form.maxRedemptions}
            onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })}
            placeholder="50"
          />
        </div>
      </Modal>
    </>
  );
}
