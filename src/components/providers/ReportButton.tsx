"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, Select, TextArea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { REPORT_REASONS } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";

type Props = {
  targetType: "USER" | "PROVIDER" | "SERVICE" | "REVIEW" | "MESSAGE";
  targetId: string;
  label?: string;
};

export function ReportButton({ targetType, targetId, label = "Report" }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, details: details || null }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not submit the report.");
      return;
    }

    setOpen(false);
    setDetails("");
    toast("Report sent. Our team will review it.");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={label || "Report"}
        // -mx-2 keeps the visual position identical while giving the control a
        // real 36px tap target on phones.
        className="-mx-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-muted transition-colors hover:text-danger"
      >
        <Icon name="flag" size={14} />
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report this"
        description="Our moderation team reviews every report. Nothing is shared with the person you are reporting."
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={submit} loading={loading} className="flex-1">
              Submit report
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>
          <Select
            label="What is the problem?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {REPORT_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <TextArea
            label="Details"
            hint="Optional, but specifics help us act faster."
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="What happened?"
          />
        </div>
      </Modal>
    </>
  );
}
