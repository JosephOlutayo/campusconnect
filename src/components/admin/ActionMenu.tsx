"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export type Action = {
  action: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  /** Prompt for a note before firing — used for suspensions and rejections. */
  needsNote?: boolean;
  confirm?: string;
};

type Props = {
  endpoint: string;
  actions: Action[];
  size?: "sm" | "md";
};

/**
 * Generic moderation control. Every admin PATCH endpoint takes the same
 * `{ action, note }` shape, so one component drives users, providers, reports
 * and reviews alike.
 */
export function ActionMenu({ endpoint, actions, size = "sm" }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const fire = async (action: Action, withNote?: string) => {
    setBusy(action.action);

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: action.action, note: withNote }),
    });
    const payload = await response.json();

    setBusy(null);
    setPending(null);
    setNote("");

    if (!payload.ok) {
      toast(payload.error ?? "That action failed.", "error");
      return;
    }

    toast(`${action.label} done.`);
    router.refresh();
  };

  const start = (action: Action) => {
    if (action.needsNote) {
      setPending(action);
      return;
    }
    if (action.confirm && !window.confirm(action.confirm)) return;
    fire(action);
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.action}
            size={size}
            variant={action.variant ?? "secondary"}
            loading={busy === action.action}
            onClick={() => start(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.label ?? ""}
        description="Add a note. Where the action notifies the person, this is what they see."
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPending(null)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={busy !== null}
              onClick={() => pending && fire(pending, note)}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <TextArea
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Reason for this action…"
          autoFocus
        />
      </Modal>
    </>
  );
}
