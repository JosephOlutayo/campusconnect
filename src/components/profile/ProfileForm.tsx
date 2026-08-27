"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, FormSection, Select, TextArea, TextField } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

type Props = {
  user: {
    name: string;
    bio: string | null;
    phone: string | null;
    universityId: string | null;
  };
  universities: Array<{ id: string; name: string }>;
};

export function ProfileForm({ user, universities }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: user.name,
    bio: user.bio ?? "",
    phone: user.phone ?? "",
    universityId: user.universityId ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        bio: form.bio || null,
        phone: form.phone || null,
        universityId: form.universityId,
      }),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not save your profile.");
      return;
    }

    toast("Profile saved.");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormError>{error}</FormError>

      <FormSection title="About you" description="This is what providers see when you book.">
        <TextField
          label="Full name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <TextArea
          label="Bio"
          hint="Optional. A sentence is plenty."
          value={form.bio}
          onChange={(event) => setForm({ ...form, bio: event.target.value })}
          rows={3}
          maxLength={500}
        />
      </FormSection>

      <FormSection
        title="Campus"
        description="Changing campus changes which providers you see first. The verified-student badge only holds while your email domain matches."
      >
        <Select
          label="University"
          value={form.universityId}
          onChange={(event) => setForm({ ...form, universityId: event.target.value })}
          required
        >
          <option value="">Select a university</option>
          {universities.map((university) => (
            <option key={university.id} value={university.id}>
              {university.name}
            </option>
          ))}
        </Select>
      </FormSection>

      <FormSection
        title="Contact"
        description="Your number is never shown to providers — it is only used for booking reminders once SMS is switched on."
      >
        <TextField
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="(555) 555-5555"
        />
      </FormSection>

      <Button type="submit" loading={loading} size="lg">
        Save changes
      </Button>
    </form>
  );
}
