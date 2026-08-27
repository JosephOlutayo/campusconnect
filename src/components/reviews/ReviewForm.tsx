"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, TextArea } from "@/components/ui/Form";
import { StarPicker } from "@/components/ui/Stars";
import { useToast } from "@/components/ui/Toast";

type Props = {
  appointmentId: string;
  providerName: string;
  /** Open by default when arriving from the "leave a review" notification. */
  defaultOpen?: boolean;
};

export function ReviewForm({ appointmentId, providerName, defaultOpen = false }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [withPhoto, setWithPhoto] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appointmentId,
        rating,
        body,
        // Real uploads land here; the demo attaches a deterministic seed.
        imageSeeds: withPhoto ? [`${appointmentId}-review-photo`] : undefined,
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not post your review.");
      return;
    }

    toast("Thanks — your review is live.");
    router.refresh();
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Leave a review
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h3 className="text-base font-semibold text-ink">How was {providerName}?</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Only students who completed an appointment can review — that is what keeps ratings honest.
        </p>
      </div>

      <FormError>{error}</FormError>

      <StarPicker value={rating} onChange={setRating} />

      <TextArea
        label="Your review"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={1500}
        required
        placeholder="What was the experience like? Was the result what you expected?"
      />

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={withPhoto}
          onChange={(event) => setWithPhoto(event.target.checked)}
          className="size-4 accent-accent"
        />
        Attach a photo of the result
      </label>

      <div className="flex gap-2">
        <Button type="submit" loading={loading} disabled={body.trim().length < 5}>
          Post review
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </form>
  );
}
