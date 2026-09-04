"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, TextArea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import {
  addDays,
  formatLongDate,
  formatTime,
  startOfDay,
  toDateKey,
  WEEKDAY_SHORT,
  type DateKey,
} from "@/lib/time";

type Props = {
  bookingId: string;
  serviceId: string;
  status: string;
  /** Which side of the booking the viewer is on. */
  role: "customer" | "provider";
  cancellationPolicy?: string;
};

type Slot = { startAt: string };

export function AppointmentActions({
  bookingId,
  serviceId,
  status,
  role,
  cancellationPolicy,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError("");

    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const payload = await response.json();

    setBusy(null);
    if (!payload.ok) {
      setError(payload.error ?? "Could not complete that action.");
      toast(payload.error ?? "Something went wrong.", "error");
      return false;
    }

    setCancelOpen(false);
    setRescheduleOpen(false);
    toast("Updated.");
    router.refresh();
    return true;
  };

  const isUpcoming = status === "PENDING" || status === "CONFIRMED";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {role === "provider" && status === "PENDING" ? (
          <>
            <Button onClick={() => act("confirm")} loading={busy === "confirm"} size="sm">
              <Icon name="check" size={16} />
              Accept
            </Button>
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(true)}
              size="sm"
            >
              Decline
            </Button>
          </>
        ) : null}

        {role === "provider" && status === "CONFIRMED" ? (
          <>
            <Button onClick={() => act("complete")} loading={busy === "complete"} size="sm">
              <Icon name="check" size={16} />
              Mark completed
            </Button>
            <Button
              variant="secondary"
              onClick={() => act("no_show")}
              loading={busy === "no_show"}
              size="sm"
            >
              No-show
            </Button>
          </>
        ) : null}

        {isUpcoming ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setRescheduleOpen(true)}>
              <Icon name="calendar" size={16} />
              Reschedule
            </Button>
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>

      <FormError>{error}</FormError>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={role === "provider" && status === "PENDING" ? "Decline this request" : "Cancel this appointment"}
        description={cancellationPolicy}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)} className="flex-1">
              Keep it
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={busy === "cancel" || busy === "decline"}
              onClick={() =>
                act(role === "provider" && status === "PENDING" ? "decline" : "cancel", { reason })
              }
            >
              {role === "provider" && status === "PENDING" ? "Decline" : "Cancel appointment"}
            </Button>
          </div>
        }
      >
        <TextArea
          label="Reason"
          hint="Optional, but the other person sees it."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Something came up…"
        />
      </Modal>

      <RescheduleModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        serviceId={serviceId}
        bookingId={bookingId}
        onPick={(startAt) => act("reschedule", { startAt })}
        busy={busy === "reschedule"}
      />
    </>
  );
}

function RescheduleModal({
  open,
  onClose,
  serviceId,
  bookingId,
  onPick,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  bookingId: string;
  onPick: (startAt: string) => void;
  busy: boolean;
}) {
  const [stripStart, setStripStart] = useState(() => startOfDay(new Date()));
  const [dateKey, setDateKey] = useState<DateKey>(() => toDateKey(new Date()));
  const [openDays, setOpenDays] = useState<Set<DateKey>>(new Set());
  // Keyed by date so "not fetched yet" is representable without a loading
  // flag set synchronously inside the effect.
  const [slotCache, setSlotCache] = useState<Record<string, Slot[]>>({});

  const slots = slotCache[dateKey];
  const loading = slots === undefined;
  const days = Array.from({ length: 7 }, (_, index) => addDays(stripStart, index));

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    (async () => {
      const response = await fetch(
        `/api/availability?serviceId=${serviceId}&from=${toDateKey(stripStart)}&days=7&exclude=${bookingId}`,
        { signal: controller.signal },
      ).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (payload?.ok) setOpenDays(new Set(payload.data.openDays as DateKey[]));
    })();
    return () => controller.abort();
  }, [open, serviceId, stripStart, bookingId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    (async () => {
      const response = await fetch(
        // `exclude` stops the current booking from blocking its own new slot.
        `/api/availability?serviceId=${serviceId}&date=${dateKey}&exclude=${bookingId}`,
        { signal: controller.signal },
      ).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (payload?.ok) {
        setSlotCache((current) => ({ ...current, [dateKey]: payload.data.slots as Slot[] }));
      }
    })();
    return () => controller.abort();
  }, [open, serviceId, dateKey, bookingId]);

  return (
    <Modal open={open} onClose={onClose} title="Pick a new time" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStripStart(addDays(stripStart, -7))}
            disabled={stripStart <= startOfDay(new Date())}
            aria-label="Previous week"
            className="rounded-xl border border-line p-2 text-ink-soft disabled:opacity-30"
          >
            <Icon name="arrowLeft" size={16} />
          </button>
          <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
            {days.map((day) => {
              const key = toDateKey(day);
              const isOpen = openDays.has(key);
              const isSelected = key === dateKey;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isOpen}
                  onClick={() => setDateKey(key)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 ${
                    isSelected
                      ? "bg-feature text-white"
                      : isOpen
                        ? "text-ink hover:bg-surface-sunken"
                        : "text-ink-faint line-through"
                  }`}
                >
                  <span className="text-[10px] opacity-70">{WEEKDAY_SHORT[day.getDay()]}</span>
                  <span className="text-sm font-bold">{day.getDate()}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStripStart(addDays(stripStart, 7))}
            aria-label="Next week"
            className="rounded-xl border border-line p-2 text-ink-soft"
          >
            <Icon name="arrowRight" size={16} />
          </button>
        </div>

        <p className="text-sm font-semibold text-ink">
          {formatLongDate(new Date(`${dateKey}T00:00:00`))}
        </p>

        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="skeleton h-10 rounded-xl" />
            ))}
          </div>
        ) : (slots ?? []).length === 0 ? (
          <p className="rounded-2xl bg-surface-sunken px-4 py-4 text-sm text-ink-muted">
            Nothing open that day.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(slots ?? []).map((slot) => (
              <button
                key={slot.startAt}
                type="button"
                disabled={busy}
                onClick={() => onPick(slot.startAt)}
                className="rounded-xl border border-line-strong py-2.5 text-[13px] font-semibold text-ink-soft transition-all hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {formatTime(new Date(slot.startAt))}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
