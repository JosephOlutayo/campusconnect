"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, TextField } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatFullDate, formatTime, toDateTimeLocalValue } from "@/lib/time";

type Block = { id: string; startAt: string; endAt: string; reason: string | null };

export function TimeOffManager({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => {
    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    return {
      startAt: toDateTimeLocalValue(start),
      endAt: toDateTimeLocalValue(end),
      reason: "",
    };
  });

  const add = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/provider/time-off", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        reason: form.reason || null,
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not block that time.");
      return;
    }

    setOpen(false);
    // The API tells us if the block collides with live bookings — surface it
    // instead of quietly hiding a conflict.
    toast(
      payload.data.conflictingAppointments > 0
        ? `Blocked — but ${payload.data.conflictingAppointments} existing booking(s) fall inside it. Reach out to those customers.`
        : "Time blocked off.",
      payload.data.conflictingAppointments > 0 ? "error" : "success",
    );
    router.refresh();
  };

  const remove = async (id: string) => {
    await fetch("/api/provider/time-off", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast("Block removed.");
    router.refresh();
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Time off</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Overrides your weekly hours — classes, exams, trips.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={15} />
          Block time
        </Button>
      </div>

      {blocks.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">Nothing blocked off.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {blocks.map((block) => {
            const start = new Date(block.startAt);
            const end = new Date(block.endAt);
            return (
              <li
                key={block.id}
                className="flex items-center gap-3 rounded-xl bg-surface-muted px-3.5 py-2.5"
              >
                <Icon name="ban" size={16} className="shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {formatFullDate(start)} · {formatTime(start)} – {formatTime(end)}
                  </p>
                  {block.reason ? (
                    <p className="truncate text-xs text-ink-muted">{block.reason}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => remove(block.id)}
                  aria-label="Remove block"
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Block off time"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={add} loading={loading} className="flex-1">
              Block it
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>
          <TextField
            label="From"
            type="datetime-local"
            value={form.startAt}
            onChange={(event) => setForm({ ...form, startAt: event.target.value })}
          />
          <TextField
            label="Until"
            type="datetime-local"
            value={form.endAt}
            onChange={(event) => setForm({ ...form, endAt: event.target.value })}
          />
          <TextField
            label="Reason"
            hint="Only you see this."
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="Midterm"
          />
        </div>
      </Modal>
    </section>
  );
}
