import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { apiGet, apiGetOptional, apiGetOrNull, getSessionUser } from "@/lib/api";
import type { CampusOverview, Category, SearchResult, University } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { SearchBar } from "@/components/search/SearchBar";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { CategoryRail } from "@/components/categories/CategoryRail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/campuses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await apiGetOptional<University>(`/api/universities/${slug}`);
  if (!data) return { title: "Campus not found" };
  return {
    title: `${data.shortName} services`,
    description: `Book barbers, braiders, tutors and more at ${data.name}.`,
  };
}

export default async function CampusPage({ params }: PageProps<"/campuses/[slug]">) {
  const { slug } = await params;

  const { data: university, notFound: missing } = await apiGetOptional<University>(
    `/api/universities/${slug}`,
  );
  if (!university || missing) notFound();

  const [user, overview, results, categories] = await Promise.all([
    getSessionUser(),
    apiGet<CampusOverview>(`/api/stats/campus?university=${slug}`),
    apiGet<SearchResult>(`/api/search?university=${university.id}&sort=recommended&perPage=12`),
    apiGet<Category[]>(`/api/categories?university=${slug}`),
  ]);

  const favoriteIds = user ? await apiGetOrNull<string[]>("/api/favorites") : null;
  const saved = new Set(favoriteIds ?? []);

  // Only the categories that actually have someone offering them here.
  const availableCategories = categories.filter((category) => category.serviceCount > 0);

  const bars = overview.topCategories.slice(0, 4).map((entry, index) => ({
    label: entry.name.split(" ")[0],
    value: Number(entry.count),
    highlight: index === 0,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${university.city}, ${university.state}`}
        title={university.name}
        subtitle={`${overview.providerCount} providers offering ${overview.serviceCount} services around campus.`}
        actions={<ButtonLink href={`/explore?university=${university.id}`}>Explore all</ButtonLink>}
      />

      <div className="mb-6">
        <SearchBar size="lg" />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption={`Booked at ${university.shortName} this month`}
          headline={String(overview.bookingsThisMonth)}
          bars={bars.length > 0 ? bars : [{ label: "Quiet", value: 1, highlight: true }]}
          footer={
            overview.topCategories[0]
              ? `${overview.topCategories[0].icon} ${overview.topCategories[0].name} is the busiest category`
              : "No bookings yet this month"
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard label="Providers" value={overview.providerCount} icon="users" />
          <StatCard
            label="Average rating"
            value={overview.averageRating > 0 ? overview.averageRating.toFixed(1) : "—"}
            icon="star"
            hint={`${overview.newProvidersThisWeek} joined in the last week`}
          />
        </div>
      </div>

      {availableCategories.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Available here" />
          <CategoryRail categories={availableCategories} />
        </section>
      ) : null}

      <section>
        <SectionHeading
          title={`Providers at ${university.shortName}`}
          subtitle={`${results.total} in total`}
        />
        {results.cards.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="Nobody here yet"
            description={`Be the first provider at ${university.shortName}. Students are already looking.`}
            action={<ButtonLink href="/provider/onboarding">Offer a service</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.cards.map((card) => (
              <ProviderCard
                key={card.providerId}
                card={card}
                isFavorite={saved.has(card.providerId)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
