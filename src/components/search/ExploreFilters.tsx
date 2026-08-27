"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LOCATION_MODES, LOCATION_MODE_LABELS } from "@/lib/constants";
import { AVAILABILITY_OPTIONS, SORT_OPTIONS } from "@/lib/search";

type Option = { id: string; name: string; slug?: string; shortName?: string };

type Props = {
  categories: Option[];
  universities: Option[];
  activeCount: number;
};

const PRICE_BANDS = [
  { label: "Under $30", min: "", max: "30" },
  { label: "$30 – $60", min: "30", max: "60" },
  { label: "$60 – $120", min: "60", max: "120" },
  { label: "$120+", min: "120", max: "" },
];

const RATINGS = [
  { label: "4.5+", value: "4.5" },
  { label: "4.0+", value: "4" },
  { label: "3.5+", value: "3.5" },
];

/**
 * Filters live entirely in the URL — every state is shareable, bookmarkable and
 * survives a refresh, and the server page stays the single source of truth.
 */
export function ExploreFilters({ categories, universities, activeCount }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`/explore?${next.toString()}`);
  };

  const toggleInList = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    const current = (next.get(key) ?? "").split(",").filter(Boolean);
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    if (updated.length === 0) next.delete(key);
    else next.set(key, updated.join(","));
    next.delete("page");
    router.push(`/explore?${next.toString()}`);
  };

  const inList = (key: string, value: string) =>
    (params.get(key) ?? "").split(",").filter(Boolean).includes(value);

  const setPriceBand = (band: (typeof PRICE_BANDS)[number]) => {
    const next = new URLSearchParams(params.toString());
    const same = next.get("min") === band.min && next.get("max") === band.max;
    if (same) {
      next.delete("min");
      next.delete("max");
    } else {
      if (band.min) next.set("min", band.min);
      else next.delete("min");
      if (band.max) next.set("max", band.max);
      else next.delete("max");
    }
    next.delete("page");
    router.push(`/explore?${next.toString()}`);
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    const q = params.get("q");
    if (q) next.set("q", q);
    router.push(`/explore?${next.toString()}`);
  };

  const body = (
    <div className="space-y-6">
      <Group title="Sort by">
        <div className="grid gap-1.5">
          {SORT_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              checked={(params.get("sort") ?? "recommended") === option.value}
              onClick={() => setParam("sort", option.value === "recommended" ? null : option.value)}
            >
              {option.label}
            </Radio>
          ))}
        </div>
      </Group>

      <Group title="Availability">
        <div className="flex flex-wrap gap-1.5">
          {AVAILABILITY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={(params.get("availability") ?? "any") === option.value}
              onClick={() =>
                setParam("availability", option.value === "any" ? null : option.value)
              }
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Category">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <Chip
              key={category.id}
              active={params.get("category") === category.slug}
              onClick={() =>
                setParam("category", params.get("category") === category.slug ? null : category.slug!)
              }
            >
              {category.name}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Price">
        <div className="flex flex-wrap gap-1.5">
          {PRICE_BANDS.map((band) => (
            <Chip
              key={band.label}
              active={params.get("min") === band.min && params.get("max") === band.max}
              onClick={() => setPriceBand(band)}
            >
              {band.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Rating">
        <div className="flex flex-wrap gap-1.5">
          {RATINGS.map((rating) => (
            <Chip
              key={rating.value}
              active={params.get("rating") === rating.value}
              onClick={() =>
                setParam("rating", params.get("rating") === rating.value ? null : rating.value)
              }
            >
              ★ {rating.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Where">
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_MODES.map((mode) => (
            <Chip key={mode} active={inList("where", mode)} onClick={() => toggleInList("where", mode)}>
              {LOCATION_MODE_LABELS[mode]}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Campus">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!params.get("university")} onClick={() => setParam("university", null)}>
            All campuses
          </Chip>
          {universities.map((university) => (
            <Chip
              key={university.id}
              active={params.get("university") === university.id}
              onClick={() =>
                setParam(
                  "university",
                  params.get("university") === university.id ? null : university.id,
                )
              }
            >
              {university.shortName ?? university.name}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Trust">
        <Chip
          active={params.get("verified") === "1"}
          onClick={() => setParam("verified", params.get("verified") === "1" ? null : "1")}
        >
          Verified providers only
        </Chip>
      </Group>

      {activeCount > 0 ? (
        <Button variant="secondary" size="sm" onClick={clearAll} className="w-full">
          Clear all filters
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop: a persistent rail. */}
      <aside className="card sticky top-6 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto p-5 lg:block">
        <h2 className="mb-5 text-base font-semibold text-ink">Filters</h2>
        {body}
      </aside>

      {/* Phone: a sheet, so the results keep the whole screen. */}
      <div className="lg:hidden">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Icon name="filter" size={16} />
          Filters
          {activeCount > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>

        {open ? (
          <div className="fixed inset-0 z-50 flex items-end">
            <button
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-feature/40 backdrop-blur-[2px]"
            />
            <div className="animate-rise relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-lg font-semibold text-ink">Filters</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-2 text-ink-muted hover:bg-surface-sunken"
                >
                  <Icon name="plus" className="rotate-45" size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{body}</div>
              <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button onClick={() => setOpen(false)} className="w-full">
                  Show results
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-ink-faint uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all ${
        active
          ? "border-accent bg-accent text-white"
          : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Radio({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
        checked ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-muted"
      }`}
    >
      <span
        className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${
          checked ? "border-accent" : "border-line-strong"
        }`}
      >
        {checked ? <span className="size-1.5 rounded-full bg-accent" /> : null}
      </span>
      {children}
    </button>
  );
}
