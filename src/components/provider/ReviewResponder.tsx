"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, TextArea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export function ReviewResponder({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");

    const result = await fetch(`/api/reviews/${reviewId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response }),
    }).then((res) => res.json());

    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Could not post your reply.");
      return;
    }

    toast("Reply posted.");
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="-mx-2 inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-accent hover:underline"
      >
        Reply publicly
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <FormError>{error}</FormError>
      <TextArea
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={3}
        maxLength={800}
        placeholder="Thanks for the feedback…"
        autoFocus
        aria-label="Your public reply"
      />
      <p className="text-xs text-ink-muted">
        Your reply is public and sits under the review forever. A calm, specific answer to a bad
        review does more for you than the review costs.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={loading} disabled={response.trim().length < 2}>
          Post reply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
