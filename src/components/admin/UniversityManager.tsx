"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, TextField, Hint } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

type University = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  city: string;
  state: string;
  color: string;
  isActive: boolean;
  providerCount: number;
  userCount: number;
  domains: string[];
};

export function UniversityManager({ universities }: { universities: University[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    shortName: "",
    slug: "",
    city: "",
    state: "",
    latitude: "",
    longitude: "",
    color: "#4F46E5",
    emailDomains: "",
  });

  const create = async () => {
    setLoading(true);
    setError("");

    let payload: { ok?: boolean; error?: string };
    try {
      const response = await fetch("/api/admin/universities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      });
      payload = await response.json();
    } catch {
      // Anything thrown here — the network dropping, a response that will not
      // parse — used to escape this function, leaving the button spinning and
      // the campus silently unsaved.
      setLoading(false);
      setError("Could not reach the server. Check your connection and try again.");
      return;
    }

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not add the campus.");
      return;
    }

    setOpen(false);
    toast("Campus added. Students can select it at signup right away.");
    router.refresh();
  };

  const toggle = async (university: University) => {
    await fetch("/api/admin/universities", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: university.id, isActive: !university.isActive }),
    });
    toast(university.isActive ? "Campus hidden." : "Campus is live.");
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} />
          Add campus
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {universities.map((university) => (
          <article key={university.id} className="card overflow-hidden">
            <div
              className="h-2 w-full"
              style={{ backgroundColor: university.color }}
              aria-hidden
            />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 truncate text-sm font-bold text-ink">
                  {university.shortName}
                </h3>
                {!university.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{university.name}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {university.city}, {university.state}
              </p>

              <dl className="mt-3 flex gap-4 text-xs">
                <div>
                  <dt className="text-ink-muted">Providers</dt>
                  <dd className="font-bold text-ink">{university.providerCount}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Users</dt>
                  <dd className="font-bold text-ink">{university.userCount}</dd>
                </div>
              </dl>

              <p className="mt-3 truncate text-xs text-ink-muted" title={university.domains.join(", ")}>
                {university.domains.length > 0
                  ? university.domains.map((domain) => `@${domain}`).join(", ")
                  : "No email domains set"}
              </p>

              <button
                onClick={() => toggle(university)}
                className="mt-3 w-full rounded-xl bg-surface-muted py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
              >
                {university.isActive ? "Hide campus" : "Activate campus"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a campus"
        description="Adding a university is pure data entry — no code change is needed to launch a new campus."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={create} loading={loading} className="flex-1">
              Add campus
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>

          <TextField
            label="Full name"
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
                slug: event.target.value
                  .toLowerCase()
                  .replace(/^the\s+/, "")
                  .replace(/university of /g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              })
            }
            placeholder="University of Houston"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Short name"
              value={form.shortName}
              onChange={(event) => setForm({ ...form, shortName: event.target.value })}
              placeholder="UH"
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="houston"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="City"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              placeholder="Houston"
            />
            <TextField
              label="State"
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
              placeholder="TX"
            />
          </div>

          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Latitude"
                type="number"
                step="0.0001"
                value={form.latitude}
                onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                placeholder="29.7199"
              />
              <TextField
                label="Longitude"
                type="number"
                step="0.0001"
                value={form.longitude}
                onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                placeholder="-95.3422"
              />
            </div>
            <Hint>Campus centre. Used for the distance shown on every provider card.</Hint>
          </div>

          <div>
            <TextField
              label="Student email domains"
              value={form.emailDomains}
              onChange={(event) => setForm({ ...form, emailDomains: event.target.value })}
              placeholder="uh.edu, cougarnet.uh.edu"
            />
            <Hint>
              Comma separated. Anyone signing up with one of these gets the verified-student badge
              automatically.
            </Hint>
          </div>

          <TextField
            label="Brand colour"
            type="color"
            value={form.color}
            onChange={(event) => setForm({ ...form, color: event.target.value })}
            className="h-11 p-1"
          />
        </div>
      </Modal>
    </>
  );
}
