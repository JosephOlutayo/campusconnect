"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatCents } from "@/lib/money";
import { LOCATION_MODE_LABELS, type LocationMode, type ServiceOffering } from "@/lib/types";
import {
  addDays,
  durationLabel,
  formatLongDate,
  formatTime,
  fromDateKey,
  startOfDay,
  toDateKey,
  WEEKDAY_SHORT,
  type DateKey,
} from "@/lib/time";


type Props = {
  providerName: string;
  services: ServiceOffering[];
  autoConfirm: boolean;
  cancellationPolicy: string;
  locationLabel: string;
  minNoticeMinutes: number;
  isSignedIn: boolean;
  initialServiceId?: string;
};

type Slot = { startAt: string; endAt: string };

const STRIP_DAYS = 7;

export function BookingWidget({
  providerName,
  services,
  autoConfirm,
  cancellationPolicy,
  locationLabel,
  minNoticeMinutes,
  isSignedIn,
  initialServiceId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [serviceId, setServiceId] = useState(initialServiceId ?? services[0]?.id ?? "");
  const [stripStart, setStripStart] = useState(() => startOfDay(new Date()));
  // null means "no explicit choice yet" — the effective day then falls through
  // to the first day with real openings, so nobody lands on an empty today.
  const [pickedDate, setPickedDate] = useState<DateKey | null>(null);
  const [openDays, setOpenDays] = useState<Set<DateKey>>(new Set());
  // Slots cached per "serviceId|date". A missing entry means "still loading",
  // which is what lets the fetch effect avoid any synchronous setState.
  const [slotCache, setSlotCache] = useState<Record<string, Slot[]>>({});
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [modeChoice, setModeChoice] = useState<LocationMode | null>(null);
  const [note, setNote] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const service = useMemo(
    () => services.find((item) => item.id === serviceId) ?? services[0],
    [services, serviceId],
  );

  // A service can offer a different set of location options than its
  // neighbour, so the choice falls back rather than being reset in an effect.
  const locationMode =
    modeChoice && service?.locationModes.includes(modeChoice)
      ? modeChoice
      : (service?.locationModes[0] ?? null);

  const days = useMemo(
    () => Array.from({ length: STRIP_DAYS }, (_, index) => addDays(stripStart, index)),
    [stripStart],
  );

  // First day in the visible week that actually has room.
  const firstOpen = days.map(toDateKey).find((key) => openDays.has(key));
  const dateKey: DateKey = pickedDate ?? firstOpen ?? toDateKey(stripStart);

  const cacheKey = service ? `${service.id}|${dateKey}` : "";
  const slots = slotCache[cacheKey];
  const loadingSlots = Boolean(service) && slots === undefined;
  // A time picked on one day must not survive a switch to another day.
  const selectedSlot =
    pickedSlot && slots?.some((slot) => slot.startAt === pickedSlot) ? pickedSlot : null;

  // Which days in the visible strip have any opening — drives the dots.
  useEffect(() => {
    if (!service) return;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(
          `/api/availability?serviceId=${service.id}&from=${toDateKey(stripStart)}&days=${STRIP_DAYS}`,
          { signal: controller.signal },
        );
        const payload = await response.json();
        if (payload.ok) setOpenDays(new Set(payload.data.openDays as DateKey[]));
      } catch {
        /* aborted */
      }
    })();

    return () => controller.abort();
  }, [service, stripStart]);

  const loadSlots = useCallback(
    async (targetDate: DateKey, signal?: AbortSignal) => {
      if (!service) return;
      const key = `${service.id}|${targetDate}`;
      try {
        const response = await fetch(
          `/api/availability?serviceId=${service.id}&date=${targetDate}`,
          { signal },
        );
        const payload = await response.json();
        if (payload.ok) {
          setSlotCache((current) => ({ ...current, [key]: payload.data.slots as Slot[] }));
        }
      } catch {
        /* aborted */
      }
    },
    [service],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Wrapped so the only setState sits behind an await rather than in the
    // synchronous effect body.
    void (async () => {
      await loadSlots(dateKey, controller.signal);
    })();
    return () => controller.abort();
  }, [dateKey, loadSlots]);

  const book = async () => {
    if (!service || !selectedSlot || !locationMode) return;
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id,
        startAt: selectedSlot,
        locationMode,
        customerNote: note || null,
        promoCode: promoCode.trim() || null,
      }),
    });
    const payload = await response.json();

    if (!payload.ok) {
      setError(payload.error ?? "Could not complete the booking.");
      setSubmitting(false);
      // A 409 means someone took the slot while this form was open — reload
      // the day so the user is not staring at a time that no longer exists.
      if (response.status === 409) await loadSlots(dateKey);
      return;
    }

    setConfirmOpen(false);
    toast(autoConfirm ? "Booked! Check your appointments." : "Request sent to the provider.");
    router.push(`/appointments/${payload.data.id}?new=1`);
    router.refresh();
  };

  if (!service) {
    return (
      <div className="card p-5 text-sm text-ink-muted">
        This provider has not listed any bookable services yet.
      </div>
    );
  }

  const selected = slots?.find((slot) => slot.startAt === selectedSlot);
  const canGoBack = stripStart > startOfDay(new Date());

  return (
    <div className="card overflow-hidden" id="book">
      <div className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-bold text-ink">{formatCents(service.priceCents)}</p>
          <p className="text-sm text-ink-muted">{durationLabel(service.durationMinutes)}</p>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          {autoConfirm
            ? "Instant booking — confirmed straight away"
            : `${providerName} reviews each request before confirming`}
        </p>
      </div>

      <div className="space-y-5 p-5">
        {/* 1. Service */}
        <Step number={1} label="Choose a service">
          <div className="space-y-2">
            {services.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setServiceId(item.id)}
                aria-pressed={item.id === serviceId}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                  item.id === serviceId
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-line-strong hover:bg-surface-muted"
                }`}
              >
                <span className="mt-0.5 text-lg">{item.categoryIcon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {durationLabel(item.durationMinutes)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-ink">
                  {formatCents(item.priceCents)}
                </span>
              </button>
            ))}
          </div>
        </Step>

        {/* 2. Date */}
        <Step number={2} label="Pick a date">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setStripStart(addDays(stripStart, -STRIP_DAYS)); setPickedDate(null); }}
              disabled={!canGoBack}
              aria-label="Previous week"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-30"
            >
              <Icon name="arrowLeft" size={16} />
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
              {days.map((day) => {
                const key = toDateKey(day);
                const isOpen = openDays.has(key);
                const isSelected = key === dateKey;
                const isToday = key === toDateKey(new Date());
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPickedDate(key)}
                    disabled={!isOpen}
                    aria-pressed={isSelected}
                    aria-label={formatLongDate(day)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-center transition-all ${
                      isSelected
                        ? "bg-feature text-white"
                        : isOpen
                          ? "text-ink hover:bg-surface-sunken"
                          : "text-ink-faint line-through"
                    }`}
                  >
                    <span className="text-[10px] font-medium opacity-70">
                      {WEEKDAY_SHORT[day.getDay()]}
                    </span>
                    <span className="text-sm font-bold">{day.getDate()}</span>
                    <span
                      className={`size-1 rounded-full ${
                        isOpen && !isSelected
                          ? "bg-success"
                          : isSelected
                            ? "bg-white"
                            : "bg-transparent"
                      }`}
                    />
                    {isToday && !isSelected ? (
                      <span className="sr-only">Today</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => { setStripStart(addDays(stripStart, STRIP_DAYS)); setPickedDate(null); }}
              aria-label="Next week"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-surface-muted"
            >
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </Step>

        {/* 3. Time */}
        <Step number={3} label={`Pick a time — ${formatLongDate(fromDateKey(dateKey))}`}>
          {loadingSlots ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="skeleton h-10 rounded-xl" />
              ))}
            </div>
          ) : (slots ?? []).length === 0 ? (
            <p className="rounded-2xl bg-surface-sunken px-4 py-4 text-sm text-ink-muted">
              No openings that day. Try another date on the strip above — green dots mean the day
              has space.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(slots ?? []).map((slot) => {
                const active = slot.startAt === selectedSlot;
                return (
                  <button
                    key={slot.startAt}
                    type="button"
                    onClick={() => setPickedSlot(slot.startAt)}
                    aria-pressed={active}
                    className={`rounded-xl border py-2.5 text-[13px] font-semibold transition-all ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-line-strong text-ink-soft hover:border-accent hover:text-accent"
                    }`}
                  >
                    {formatTime(new Date(slot.startAt))}
                  </button>
                );
              })}
            </div>
          )}
        </Step>

        {/* 4. Where */}
        {service.locationModes.length > 1 ? (
          <Step number={4} label="Where should it happen?">
            <div className="grid gap-2 sm:grid-cols-2">
              {service.locationModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setModeChoice(mode)}
                  aria-pressed={locationMode === mode}
                  className={`rounded-2xl border p-3 text-left text-[13px] font-semibold transition-all ${
                    locationMode === mode
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-ink-soft hover:border-line-strong"
                  }`}
                >
                  {LOCATION_MODE_LABELS[mode]}
                  <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                    {mode === "AT_PROVIDER" ? locationLabel : mode === "ONLINE" ? "Link shared after booking" : "You share the address after confirming"}
                  </span>
                </button>
              ))}
            </div>
          </Step>
        ) : null}

        <Button
          size="lg"
          className="w-full"
          disabled={!selectedSlot}
          onClick={() => (isSignedIn ? setConfirmOpen(true) : router.push("/login"))}
        >
          {!isSignedIn
            ? "Sign in to book"
            : selectedSlot
              ? `Book ${formatTime(new Date(selectedSlot))} · ${formatCents(service.priceCents)}`
              : "Select a time"}
        </Button>

        <p className="text-center text-xs text-ink-muted">
          {minNoticeMinutes >= 60
            ? `Requires ${Math.round(minNoticeMinutes / 60)} hour${minNoticeMinutes >= 120 ? "s" : ""} notice`
            : `Requires ${minNoticeMinutes} minutes notice`}{" "}
          · {cancellationPolicy}
        </p>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm your booking"
        description={providerName}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} className="flex-1">
              Back
            </Button>
            <Button onClick={book} loading={submitting} className="flex-1">
              {autoConfirm ? "Confirm booking" : "Send request"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>

          <dl className="divide-y divide-line rounded-2xl border border-line">
            <Row label="Service" value={service.title} />
            <Row
              label="When"
              value={
                selected
                  ? `${formatLongDate(new Date(selected.startAt))} · ${formatTime(new Date(selected.startAt))}`
                  : "—"
              }
            />
            <Row label="Length" value={durationLabel(service.durationMinutes)} />
            <Row
              label="Where"
              value={locationMode ? LOCATION_MODE_LABELS[locationMode] : "—"}
            />
            <Row label="Price" value={formatCents(service.priceCents)} strong />
          </dl>

          <div>
            <label htmlFor="booking-note" className="mb-1.5 block text-sm font-semibold text-ink">
              Anything they should know? <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id="booking-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Reference photos, allergies, where to park…"
              className="field resize-none"
            />
          </div>

          <div>
            <label htmlFor="promo" className="mb-1.5 block text-sm font-semibold text-ink">
              Promo code <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="promo"
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              placeholder="FIRST10"
              className="field uppercase"
            />
          </div>

          <p className="rounded-2xl bg-surface-sunken px-4 py-3 text-xs text-ink-muted">
            {autoConfirm
              ? "Your booking is confirmed immediately. You can cancel or reschedule from your appointments."
              : "The provider has to accept before this is confirmed. You will get a notification either way."}{" "}
            {cancellationPolicy}
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Step({
  number,
  label,
  children,
}: {
  number: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-feature text-[10px] font-bold text-white">
          {number}
        </span>
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`text-right text-sm ${strong ? "font-bold text-ink" : "font-medium text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
