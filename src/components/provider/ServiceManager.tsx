"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, Select, TextArea, TextField, Label, Hint } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatCents, centsToDollars } from "@/lib/money";
import { durationLabel } from "@/lib/time";
import { LOCATION_MODES, LOCATION_MODE_LABELS, type LocationMode } from "@/lib/constants";

export type ManagedService = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  isActive: boolean;
  bookingCount: number;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  locationModes: LocationMode[];
};

type Props = {
  services: ManagedService[];
  categories: Array<{ id: string; name: string; icon: string }>;
  feePercent: number;
  defaultModes: LocationMode[];
};

const BLANK = {
  title: "",
  description: "",
  categoryId: "",
  priceDollars: "",
  durationMinutes: "60",
  locationModes: [] as LocationMode[],
  isActive: true,
};

export function ServiceManager({ services, categories, feePercent, defaultModes }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ManagedService | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const openCreate = () => {
    setForm({ ...BLANK, categoryId: categories[0]?.id ?? "", locationModes: defaultModes });
    setEditing(null);
    setCreating(true);
    setError("");
  };

  const openEdit = (service: ManagedService) => {
    setForm({
      title: service.title,
      description: service.description,
      categoryId: service.categoryId,
      priceDollars: String(centsToDollars(service.priceCents)),
      durationMinutes: String(service.durationMinutes),
      locationModes: service.locationModes,
      isActive: service.isActive,
    });
    setEditing(service);
    setCreating(false);
    setError("");
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    setLoading(true);
    setError("");

    const payload = {
      title: form.title,
      description: form.description,
      categoryId: form.categoryId,
      priceDollars: Number(form.priceDollars),
      durationMinutes: Number(form.durationMinutes),
      locationModes: form.locationModes,
      isActive: form.isActive,
    };

    const response = await fetch(
      editing ? `/api/provider/services/${editing.id}` : "/api/provider/services",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json();

    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the service.");
      return;
    }

    close();
    toast(editing ? "Service updated." : "Service added.");
    router.refresh();
  };

  const remove = async (service: ManagedService) => {
    const response = await fetch(`/api/provider/services/${service.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.ok) {
      toast(result.error ?? "Could not remove that service.", "error");
      return;
    }
    toast(result.data.archived ? "Service hidden — past bookings keep their history." : "Service deleted.");
    router.refresh();
  };

  const toggleActive = async (service: ManagedService) => {
    await fetch(`/api/provider/services/${service.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    toast(service.isActive ? "Service paused." : "Service is live again.");
    router.refresh();
  };

  const price = Number(form.priceDollars) || 0;
  const keeps = price - (price * feePercent) / 100;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Icon name="plus" size={16} />
          Add service
        </Button>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <article key={service.id} className="card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-sunken text-xl">
                {service.categoryIcon}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-ink">{service.title}</h3>
                  {service.isActive ? (
                    <Badge tone="success">Live</Badge>
                  ) : (
                    <Badge tone="neutral">Paused</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{service.description}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {service.categoryName} · {durationLabel(service.durationMinutes)} ·{" "}
                  {service.bookingCount} booking{service.bookingCount === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {service.locationModes.map((mode) => (
                    <Badge key={mode} tone="neutral">
                      {LOCATION_MODE_LABELS[mode]}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-ink">{formatCents(service.priceCents)}</p>
                <p className="text-xs text-ink-muted">
                  you keep{" "}
                  {formatCents(service.priceCents - Math.floor((service.priceCents * feePercent) / 100))}
                </p>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEdit(service)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-sunken"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(service)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-sunken"
                  >
                    {service.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => remove(service)}
                    aria-label={`Delete ${service.title}`}
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={creating || editing !== null}
        onClose={close}
        title={editing ? "Edit service" : "Add a service"}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close} className="flex-1">
              Cancel
            </Button>
            <Button onClick={save} loading={loading} className="flex-1">
              {editing ? "Save changes" : "Add service"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>

          <Select
            label="Category"
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
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
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Signature Haircut"
          />

          <TextArea
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={3}
            placeholder="What is included and what should they bring?"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Price (USD)"
              type="number"
              min={1}
              value={form.priceDollars}
              onChange={(event) => setForm({ ...form, priceDollars: event.target.value })}
            />
            <TextField
              label="Length (minutes)"
              type="number"
              min={10}
              step={5}
              value={form.durationMinutes}
              onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
            />
          </div>

          {price > 0 ? (
            <p className="rounded-2xl bg-success-soft px-4 py-2.5 text-sm text-success">
              You keep <strong>${keeps.toFixed(2)}</strong> after the {feePercent}% fee.
            </p>
          ) : null}

          <div>
            <Label>Where can this happen?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {LOCATION_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      locationModes: form.locationModes.includes(mode)
                        ? form.locationModes.filter((item) => item !== mode)
                        : [...form.locationModes, mode],
                    })
                  }
                  aria-pressed={form.locationModes.includes(mode)}
                  className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                    form.locationModes.includes(mode)
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-ink-soft"
                  }`}
                >
                  {LOCATION_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <Hint>Leave all unselected to inherit your business default.</Hint>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              className="size-4 accent-accent"
            />
            Visible to students right now
          </label>
        </div>
      </Modal>
    </>
  );
}
