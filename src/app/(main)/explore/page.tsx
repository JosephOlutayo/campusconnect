import type { Metadata } from "next";
import Link from "next/link";

import { apiGet, apiGetOrNull, getSessionUser } from "@/lib/api";
import { SORT_OPTIONS } from "@/lib/search";
import type { Category, SearchResult, University } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { SearchBar } from "@/components/search/SearchBar";
import { ExploreFilters } from "@/components/search/ExploreFilters";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Explore services" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

function countActiveFilters(search: Search): number {
  return [
    search.category,
    search.university,
    search.min,
    search.max,
    search.rating,
    search.where,
    search.availability,
    search.verified,
    search.sort && search.sort !== "recommended" ? search.sort : undefined,
  ].filter(Boolean).length;
}

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const search = (await searchParams) as Search;

  // The filter UI speaks dollars; the API speaks cents.
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.category) params.set("category", search.category);
  if (search.university) params.set("university", search.university);
  if (search.min) params.set("minPrice", String(Number(search.min) * 100));
  if (search.max) params.set("maxPrice", String(Number(search.max) * 100));
  if (search.rating) params.set("minRating", search.rating);
  if (search.where) params.set("where", search.where);
  if (search.availability) params.set("availability", search.availability);
  if (search.sort) params.set("sort", search.sort);
  if (search.verified === "1") params.set("verified", "true");
  params.set("page", search.page ?? "1");
  params.set("perPage", "12");

  const [user, categories, universities, results] = await Promise.all([
    getSessionUser(),
    apiGet<Category[]>("/api/categories"),
    apiGet<University[]>("/api/universities"),
    apiGet<SearchResult>(`/api/search?${params.toString()}`),
  ]);

  const favoriteIds = user ? await apiGetOrNull<string[]>("/api/favorites") : null;
  const saved = new Set(favoriteIds ?? []);

  const activeCategory = categories.find((category) => category.slug === search.category);
  const activeUniversity = universities.find((university) => university.id === search.university);
  const activeFilters = countActiveFilters(search);
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === (search.sort ?? "recommended"))?.label ??
    "Recommended";

  const heading = search.q
    ? `Results for “${search.q}”`
    : activeCategory
      ? activeCategory.name
      : "Explore services";

  return (
    <>
      <PageHeader
        eyebrow={
          activeUniversity
            ? activeUniversity.shortName
            : user?.universityShortName ?? "All campuses"
        }
        title={heading}
        subtitle={
          results.total > 0
            ? `${results.total} provider${results.total === 1 ? "" : "s"} · sorted by ${sortLabel.toLowerCase()}`
            : undefined
        }
      />

      <div className="mb-5">
        <SearchBar size="lg" defaultValue={search.q ?? ""} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <ExploreFilters
          categories={categories}
          universities={universities}
          activeCount={activeFilters}
        />
        <p className="text-sm text-ink-muted">{results.total} results</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ExploreFilters
            categories={categories}
            universities={universities}
            activeCount={activeFilters}
          />
        </div>

        <div className="min-w-0">
          {results.cards.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="Nothing matched those filters"
              description={
                search.q
                  ? `We could not find anyone offering “${search.q}” with those filters. Try widening the price range or checking all campuses.`
                  : "Try loosening a filter or two — or check every campus instead of just yours."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/explore" variant="secondary">
                    Clear filters
                  </ButtonLink>
                  <ButtonLink href="/categories">Browse categories</ButtonLink>
                </div>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.cards.map((card) => (
                  <ProviderCard
                    key={card.providerId}
                    card={card}
                    isFavorite={saved.has(card.providerId)}
                  />
                ))}
              </div>

              {results.totalPages > 1 ? (
                <Pagination page={results.page} totalPages={results.totalPages} search={search} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Pagination({
  page,
  totalPages,
  search,
}: {
  page: number;
  totalPages: number;
  search: Search;
}) {
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value && key !== "page") params.set(key, String(value));
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/explore?${query}` : "/explore";
  };

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-muted"
        >
          Previous
        </Link>
      ) : null}
      <span className="px-3 text-sm text-ink-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-muted"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
