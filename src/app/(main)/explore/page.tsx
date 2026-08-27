import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getSessionUser } from "@/lib/auth";
import { getCategories, getFavoriteIds, getUniversities } from "@/lib/queries";
import { searchProviders, SORT_OPTIONS, type SortOption } from "@/lib/search";
import { LOCATION_MODES, type LocationMode } from "@/lib/constants";
import { dollarsToCents } from "@/lib/money";

import { PageHeader } from "@/components/shell/PageHeader";
import { SearchBar } from "@/components/search/SearchBar";
import { ExploreFilters } from "@/components/search/ExploreFilters";
import { ProviderCard, ProviderCardSkeleton } from "@/components/providers/ProviderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Explore services" };
export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  category?: string;
  university?: string;
  min?: string;
  max?: string;
  rating?: string;
  where?: string;
  availability?: string;
  sort?: string;
  verified?: string;
  page?: string;
};

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
  const [user, categories, universities] = await Promise.all([
    getSessionUser(),
    getCategories(),
    getUniversities(),
  ]);

  // No explicit campus filter? Default to the student's own campus, but keep
  // the "All campuses" escape hatch one tap away.
  const universityId = search.university ?? user?.universityId ?? undefined;

  const where = (search.where ?? "")
    .split(",")
    .filter((mode): mode is LocationMode => (LOCATION_MODES as readonly string[]).includes(mode));

  const results = await searchProviders({
    q: search.q,
    categorySlug: search.category,
    universityId,
    minPriceCents: search.min ? dollarsToCents(search.min) : undefined,
    maxPriceCents: search.max ? dollarsToCents(search.max) : undefined,
    minRating: search.rating ? Number(search.rating) : undefined,
    locationModes: where.length > 0 ? where : undefined,
    availability: (search.availability as "any" | "today" | "week") ?? "any",
    sort: (search.sort as SortOption) ?? "recommended",
    verifiedOnly: search.verified === "1",
    page: Number(search.page ?? 1),
    perPage: 12,
  });

  const favoriteIds = await getFavoriteIds(user?.id);
  const activeCategory = categories.find((category) => category.slug === search.category);
  const activeUniversity = universities.find((university) => university.id === universityId);
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
        eyebrow={activeUniversity ? activeUniversity.shortName : "All campuses"}
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
          <Suspense fallback={<ResultsSkeleton />}>
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
                      isFavorite={favoriteIds.has(card.providerId)}
                    />
                  ))}
                </div>

                {results.totalPages > 1 ? (
                  <Pagination
                    page={results.page}
                    totalPages={results.totalPages}
                    search={search}
                  />
                ) : null}
              </>
            )}
          </Suspense>
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

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <ProviderCardSkeleton key={index} />
      ))}
    </div>
  );
}
