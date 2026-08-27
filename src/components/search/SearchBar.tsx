"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents } from "@/lib/money";

type Suggestions = {
  categories: Array<{ name: string; slug: string; icon: string }>;
  providers: Array<{ id: string; businessName: string; ratingAvg: number; user: { avatarSeed: string } }>;
  services: Array<{
    id: string;
    title: string;
    priceCents: number;
    provider: { id: string; businessName: string };
  }>;
};

const EMPTY: Suggestions = { categories: [], providers: [], services: [] };

type Props = {
  placeholder?: string;
  defaultValue?: string;
  size?: "sm" | "lg";
  autoFocus?: boolean;
  className?: string;
};

export function SearchBar({
  placeholder = "What service are you looking for?",
  defaultValue = "",
  size = "sm",
  autoFocus = false,
  className = "",
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [cache, setResults] = useState<{ term: string; data: Suggestions }>({
    term: "",
    data: EMPTY,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const term = value.trim();
  // Only show suggestions that belong to what is currently typed; anything else
  // is a stale response for an older term.
  const results = cache.term === term ? cache.data : EMPTY;
  const loading = term.length >= 2 && cache.term !== term;

  // Debounced typeahead. The abort controller means a slow response for
  // "bar" can never overwrite the fresher results for "barber".
  //
  // Results are stored keyed by the term they belong to, so a short query needs
  // no state reset — the render below simply does not match, which keeps every
  // setState inside the async callback where it belongs.
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (payload.ok) setResults({ term, data: payload.data as Suggestions });
      } catch {
        // Aborted or offline — leave the previous suggestions in place.
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const submit = (term: string) => {
    setOpen(false);
    router.push(term.trim() ? `/explore?q=${encodeURIComponent(term.trim())}` : "/explore");
  };

  const hasResults =
    results.categories.length + results.providers.length + results.services.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        role="search"
      >
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
            size={size === "lg" ? 20 : 18}
          />
          <input
            type="search"
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label="Search services"
            className={`field pl-11 ${
              size === "lg"
                ? "h-14 rounded-2xl pr-32 text-base shadow-[var(--shadow-soft)]"
                : "h-11 pr-4"
            }`}
          />
          {size === "lg" ? (
            <button
              type="submit"
              className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Search
            </button>
          ) : null}
        </div>
      </form>

      {open && value.trim().length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
          {!hasResults ? (
            <p className="px-4 py-5 text-sm text-ink-muted">
              {loading ? "Searching…" : `No matches for “${value.trim()}” yet.`}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {results.categories.length > 0 ? (
                <Group label="Categories">
                  {results.categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/explore?category=${category.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted"
                    >
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium text-ink">{category.name}</span>
                    </Link>
                  ))}
                </Group>
              ) : null}

              {results.providers.length > 0 ? (
                <Group label="Providers">
                  {results.providers.map((provider) => (
                    <Link
                      key={provider.id}
                      href={`/providers/${provider.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted"
                    >
                      <Avatar
                        seed={provider.user.avatarSeed}
                        name={provider.businessName}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {provider.businessName}
                      </span>
                      {provider.ratingAvg > 0 ? (
                        <span className="text-xs font-semibold text-ink-muted">
                          ★ {provider.ratingAvg.toFixed(1)}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </Group>
              ) : null}

              {results.services.length > 0 ? (
                <Group label="Services">
                  {results.services.map((service) => (
                    <Link
                      key={service.id}
                      href={`/providers/${service.provider.id}?service=${service.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-ink">{service.title}</span>
                        <span className="text-ink-muted"> · {service.provider.businessName}</span>
                      </span>
                      <span className="text-xs font-bold text-ink">
                        {formatCents(service.priceCents)}
                      </span>
                    </Link>
                  ))}
                </Group>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 pt-1 pb-1 text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
