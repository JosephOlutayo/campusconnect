"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError, TextField, TextArea, Hint } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  keywords: string;
  color: string;
  isActive: boolean;
  serviceCount: number;
};

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    icon: "✨",
    description: "",
    keywords: "",
    color: "#4F46E5",
  });

  const create = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();

    setLoading(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not create the category.");
      return;
    }

    setOpen(false);
    setForm({ name: "", slug: "", icon: "✨", description: "", keywords: "", color: "#4F46E5" });
    toast("Category added.");
    router.refresh();
  };

  const toggle = async (category: Category) => {
    await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: category.id, isActive: !category.isActive }),
    });
    toast(category.isActive ? "Category hidden." : "Category is live.");
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} />
          New category
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <article key={category.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl"
                style={{ backgroundColor: `${category.color}18` }}
              >
                {category.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-ink">{category.name}</h3>
                  {!category.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                  {category.description}
                </p>
                <p className="mt-2 text-xs text-ink-faint">
                  /{category.slug} · {category.serviceCount} service
                  {category.serviceCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <button
              onClick={() => toggle(category)}
              className="mt-3 w-full rounded-xl bg-surface-muted py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
            >
              {category.isActive ? "Hide from search" : "Show in search"}
            </button>
          </article>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a category"
        description="Keywords are what make fuzzy search work — put every word a student might type."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={create} loading={loading} className="flex-1">
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>

          <div className="grid gap-4 sm:grid-cols-[80px_minmax(0,1fr)]">
            <TextField
              label="Icon"
              value={form.icon}
              onChange={(event) => setForm({ ...form, icon: event.target.value })}
              maxLength={4}
              className="text-center text-xl"
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                  // Auto-slug, but still editable below.
                  slug: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                })
              }
              placeholder="Pet Grooming"
            />
          </div>

          <TextField
            label="Slug"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
            placeholder="pet-grooming"
          />

          <TextArea
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={2}
            placeholder="Washes, trims and nail clipping for campus pets."
          />

          <div>
            <TextArea
              label="Search keywords"
              value={form.keywords}
              onChange={(event) => setForm({ ...form, keywords: event.target.value })}
              rows={2}
              placeholder="pet,dog,grooming,groomer,cat,wash"
            />
            <Hint>Comma separated. These are matched against what students type.</Hint>
          </div>

          <TextField
            label="Colour"
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
