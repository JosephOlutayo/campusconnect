"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, TextArea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

type Props = {
  providerId: string;
  providerName: string;
  isSignedIn: boolean;
  variant?: "primary" | "secondary";
};

export function MessageProviderButton({
  providerId,
  providerName,
  isSignedIn,
  variant = "secondary",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, body }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not send the message.");
      return;
    }

    setOpen(false);
    router.push(`/messages/${payload.data.id}`);
  };

  return (
    <>
      <Button
        variant={variant}
        onClick={() => (isSignedIn ? setOpen(true) : router.push("/login"))}
      >
        <Icon name="chat" size={16} />
        Message
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Message ${providerName}`}
        description="Phone numbers stay private — everything runs through the app."
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={send} loading={loading} disabled={body.trim().length === 0} className="flex-1">
              Send
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>
          <TextArea
            label="Your message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Hey! Do you have anything Thursday evening?"
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
}
