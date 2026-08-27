"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, Select, TextArea, TextField, Label, Hint } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { LOCATION_MODES, LOCATION_MODE_LABELS, type LocationMode } from "@/lib/constants";

type Props = {
  categories: Array<{ id: string; name: string; icon: string }>;
  universityName: string;
  feePercent: number;
};

const STEPS = ["Your business", "Where you work", "First service"] as const;

export function OnboardingForm({ categories, universityName, feePercent }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    tagline: "",
    bio: "",
    locationLabel: "",
    exactAddress: "",
    locationModes: ["AT_PROVIDER"] as LocationMode[],
    categoryId: "",
    serviceTitle: "",
    serviceDescription: "",
    priceDollars: "",
    durationMinutes: "60",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleMode = (mode: LocationMode) => {
    set(
      "locationModes",
      form.locationModes.includes(mode)
        ? form.locationModes.filter((item) => item !== mode)
        : [...form.locationModes, mode],
    );
  };

  // Each step gates on only the fields it owns, so nobody hits "Finish" and is
  // told about a problem three screens back.
  const stepValid = [
    form.businessName.trim().length >= 2 && form.bio.trim().length >= 20,
    form.locationLabel.trim().length >= 3 && form.locationModes.length > 0,
    Boolean(form.categoryId) &&
      form.serviceTitle.trim().length >= 2 &&
      form.serviceDescription.trim().length >= 10 &&
      Number(form.priceDollars) >= 1 &&
      Number(form.durationMinutes) >= 10,
  ];

  const submit = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/provider/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        tagline: form.tagline || null,
        exactAddress: form.exactAddress || null,
        priceDollars: Number(form.priceDollars),
        durationMinutes: Number(form.durationMinutes),
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not create your provider profile.");
      return;
    }

    router.push("/provider");
    router.refresh();
  };

  const earnings = Number(form.priceDollars) || 0;
  const providerKeeps = earnings - (earnings * feePercent) / 100;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <ol className="mb-7 flex items-center gap-2">
        {STEPS.map((label, index) => (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                index < step
                  ? "bg-success text-white"
                  : index === step
                    ? "bg-feature text-white"
                    : "bg-surface-sunken text-ink-muted"
              }`}
            >
              {index < step ? <Icon name="check" size={14} /> : index + 1}
            </span>
            <span
              className={`hidden truncate text-xs font-semibold sm:block ${
                index === step ? "text-ink" : "text-ink-muted"
              }`}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="hidden h-px min-w-4 flex-1 bg-line sm:block" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="card space-y-5 p-5 sm:p-6">
        <FormError>{error}</FormError>

        {step === 0 ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-ink">What do you call your business?</h2>
              <p className="mt-1 text-sm text-ink-muted">
                This is the name students search for. It does not have to be your legal name.
              </p>
            </div>
            <TextField
              label="Business name"
              value={form.businessName}
              onChange={(event) => set("businessName", event.target.value)}
              placeholder="Campus Cuts"
              required
            />
            <TextField
              label="Tagline"
              hint="One line. Shows under your name in search."
              value={form.tagline}
              onChange={(event) => set("tagline", event.target.value)}
              placeholder="Fades between classes — 10 minutes from the Student Union"
              maxLength={120}
            />
            <TextArea
              label="About your work"
              hint="At least a couple of sentences. What do you do, how do you work, what should someone expect?"
              value={form.bio}
              onChange={(event) => set("bio", event.target.value)}
              rows={5}
              maxLength={2000}
              required
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-ink">Where do you work?</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Students see the general area only. Your exact address is released to a customer
                after you confirm their booking — never before.
              </p>
            </div>

            <div>
              <Label>How do you work?</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {LOCATION_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => toggleMode(mode)}
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
              <Hint>Pick every option that applies. You can change this later.</Hint>
            </div>

            <TextField
              label="Public location"
              hint="A neighbourhood or landmark — not a street address."
              value={form.locationLabel}
              onChange={(event) => set("locationLabel", event.target.value)}
              placeholder={`Near ${universityName} campus`}
              required
            />
            <TextField
              label="Exact address"
              hint="Optional. Only shown to customers with a confirmed booking."
              value={form.exactAddress}
              onChange={(event) => set("exactAddress", event.target.value)}
              placeholder="800 Waterview Pkwy, Apt 12"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-ink">Add your first service</h2>
              <p className="mt-1 text-sm text-ink-muted">
                You can add more later. Start with the one people book most.
              </p>
            </div>

            <Select
              label="Category"
              value={form.categoryId}
              onChange={(event) => set("categoryId", event.target.value)}
              required
            >
              <option value="">Pick a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </Select>

            <TextField
              label="Service name"
              value={form.serviceTitle}
              onChange={(event) => set("serviceTitle", event.target.value)}
              placeholder="Signature Haircut"
              required
            />
            <TextArea
              label="Description"
              value={form.serviceDescription}
              onChange={(event) => set("serviceDescription", event.target.value)}
              rows={3}
              placeholder="What is included, and what should they bring or expect?"
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Price (USD)"
                type="number"
                min={1}
                step="1"
                value={form.priceDollars}
                onChange={(event) => set("priceDollars", event.target.value)}
                placeholder="25"
                required
              />
              <TextField
                label="Length (minutes)"
                type="number"
                min={10}
                step="5"
                value={form.durationMinutes}
                onChange={(event) => set("durationMinutes", event.target.value)}
                required
              />
            </div>

            {earnings > 0 ? (
              <p className="rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
                At ${earnings.toFixed(2)}, you keep{" "}
                <strong>${providerKeeps.toFixed(2)}</strong> per booking after the {feePercent}%
                marketplace fee.
              </p>
            ) : null}

            <p className="rounded-2xl bg-surface-sunken px-4 py-3 text-xs text-ink-muted">
              We will set you up Monday to Friday, 10am–6pm to start. Change it any time from
              Availability — that is what students book against.
            </p>
          </>
        ) : null}

        <div className="flex gap-2 border-t border-line pt-5">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!stepValid[step]}
              className="flex-1"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={submit}
              loading={loading}
              disabled={!stepValid[step]}
              className="flex-1"
            >
              Start taking bookings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
