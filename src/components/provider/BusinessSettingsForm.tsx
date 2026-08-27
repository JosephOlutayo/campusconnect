"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  FormError,
  FormSection,
  Label,
  Hint,
  Select,
  TextArea,
  TextField,
} from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { LOCATION_MODES, LOCATION_MODE_LABELS, type LocationMode } from "@/lib/constants";

type Props = {
  profile: {
    businessName: string;
    tagline: string | null;
    bio: string;
    locationLabel: string;
    exactAddress: string | null;
    locationModes: LocationMode[];
    autoConfirmBookings: boolean;
    bufferMinutes: number;
    minNoticeMinutes: number;
    maxAdvanceDays: number;
    cancellationPolicy: string;
    status: string;
  };
};

export function BusinessSettingsForm({ profile }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    ...profile,
    tagline: profile.tagline ?? "",
    exactAddress: profile.exactAddress ?? "",
    status: profile.status === "PAUSED" ? "PAUSED" : "ACTIVE",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/provider/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessName: form.businessName,
        tagline: form.tagline || null,
        bio: form.bio,
        locationLabel: form.locationLabel,
        exactAddress: form.exactAddress || null,
        locationModes: form.locationModes,
        autoConfirmBookings: form.autoConfirmBookings,
        bufferMinutes: Number(form.bufferMinutes),
        minNoticeMinutes: Number(form.minNoticeMinutes),
        maxAdvanceDays: Number(form.maxAdvanceDays),
        cancellationPolicy: form.cancellationPolicy,
        status: form.status,
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not save your settings.");
      return;
    }

    toast("Business settings saved.");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormError>{error}</FormError>

      <FormSection title="Your listing" description="What students see in search and on your profile.">
        <TextField
          label="Business name"
          value={form.businessName}
          onChange={(event) => set("businessName", event.target.value)}
          required
        />
        <TextField
          label="Tagline"
          value={form.tagline}
          onChange={(event) => set("tagline", event.target.value)}
          maxLength={120}
        />
        <TextArea
          label="About your work"
          value={form.bio}
          onChange={(event) => set("bio", event.target.value)}
          rows={6}
          required
        />
      </FormSection>

      <FormSection
        title="Location"
        description="The public label is all anyone sees until they have a confirmed booking with you."
      >
        <div>
          <Label>How you work</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {LOCATION_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  set(
                    "locationModes",
                    form.locationModes.includes(mode)
                      ? form.locationModes.filter((item) => item !== mode)
                      : [...form.locationModes, mode],
                  )
                }
                aria-pressed={form.locationModes.includes(mode)}
                className={`rounded-2xl border p-3 text-left text-[13px] font-semibold transition-all ${
                  form.locationModes.includes(mode)
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-ink-soft hover:border-line-strong"
                }`}
              >
                {LOCATION_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
        <TextField
          label="Public location"
          value={form.locationLabel}
          onChange={(event) => set("locationLabel", event.target.value)}
          required
        />
        <TextField
          label="Exact address"
          hint="Released only to customers with a confirmed booking."
          value={form.exactAddress}
          onChange={(event) => set("exactAddress", event.target.value)}
        />
      </FormSection>

      <FormSection
        title="Booking rules"
        description="These drive which slots the calendar offers. Get them right and your calendar manages itself."
      >
        <div>
          <Label>Booking approval</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                value: true,
                title: "Instant booking",
                body: "Slots are confirmed the moment a student books. More bookings, less admin.",
              },
              {
                value: false,
                title: "Review each request",
                body: "You accept or decline. Better if you need to vet the job first.",
              },
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => set("autoConfirmBookings", option.value)}
                aria-pressed={form.autoConfirmBookings === option.value}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  form.autoConfirmBookings === option.value
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="block text-[13px] font-semibold text-ink">{option.title}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{option.body}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <TextField
              label="Buffer (min)"
              type="number"
              min={0}
              max={240}
              step={5}
              value={form.bufferMinutes}
              onChange={(event) => set("bufferMinutes", Number(event.target.value))}
            />
            <Hint>Turnaround reserved after every booking.</Hint>
          </div>
          <div>
            <TextField
              label="Notice (min)"
              type="number"
              min={0}
              step={30}
              value={form.minNoticeMinutes}
              onChange={(event) => set("minNoticeMinutes", Number(event.target.value))}
            />
            <Hint>How far ahead someone must book.</Hint>
          </div>
          <div>
            <TextField
              label="Book ahead (days)"
              type="number"
              min={1}
              max={365}
              value={form.maxAdvanceDays}
              onChange={(event) => set("maxAdvanceDays", Number(event.target.value))}
            />
            <Hint>How far into the future the calendar goes.</Hint>
          </div>
        </div>

        <TextArea
          label="Cancellation policy"
          hint="Shown before anyone confirms a booking."
          value={form.cancellationPolicy}
          onChange={(event) => set("cancellationPolicy", event.target.value)}
          rows={2}
          required
        />
      </FormSection>

      <FormSection
        title="Listing status"
        description="Pausing hides you from search and stops new bookings. Existing appointments are untouched."
      >
        <Select
          label="Status"
          value={form.status}
          onChange={(event) => set("status", event.target.value)}
        >
          <option value="ACTIVE">Active — taking bookings</option>
          <option value="PAUSED">Paused — hidden from students</option>
        </Select>
      </FormSection>

      <Button type="submit" loading={loading} size="lg">
        Save settings
      </Button>
    </form>
  );
}
