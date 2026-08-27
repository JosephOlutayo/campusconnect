import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getCampusActivity, getCampusStats, getFavoriteIds } from "@/lib/queries";
import { searchProviders } from "@/lib/search";

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
  const university = await prisma.university.findUnique({
    where: { slug },
    select: { name: true, shortName: true },
  });
  if (!university) return { title: "Campus not found" };
  return {
    title: `${university.shortName} services`,
    description: `Book barbers, braiders, tutors and more at ${university.name}.`,
  };
}

export default async function CampusPage({ params }: PageProps<"/campuses/[slug]">) {
  const { slug } = await params;
  const university = await prisma.university.findUnique({ where: { slug } });
  if (!university) notFound();

  const [user, stats, activity, results] = await Promise.all([
    getSessionUser(),
    getCampusStats(university.id),
    getCampusActivity(university.id),
    searchProviders({ universityId: university.id, sort: "recommended", perPage: 12 }),
  ]);

  const favoriteIds = await getFavoriteIds(user?.id);

  // Only the categories that actually have providers here.
  const categoryIds = await prisma.service.findMany({
    where: { isActive: true, provider: { universityId: university.id, status: "ACTIVE" } },
    select: { categoryId: true },
    distinct: ["categoryId"],
  });
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds.map((row) => row.categoryId) }, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { services: { where: { isActive: true } } } } },
  });

  const bars = activity.ranked.slice(0, 4).map((entry, index) => ({
    label: entry.name.split(" ")[0],
    value: entry.count,
    highlight: index === 0,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${university.city}, ${university.state}`}
        title={university.name}
        subtitle={`${stats.providerCount} providers offering ${stats.serviceCount} services around campus.`}
        actions={<ButtonLink href={`/explore?university=${university.id}`}>Explore all</ButtonLink>}
      />

      <div className="mb-6">
        <SearchBar size="lg" />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeatureChart
          caption={`Booked at ${university.shortName} this month`}
          headline={String(activity.total)}
          bars={bars.length > 0 ? bars : [{ label: "Quiet", value: 1, highlight: true }]}
          footer={
            activity.ranked[0]
              ? `${activity.ranked[0].icon} ${activity.ranked[0].name} is the busiest category`
              : "No bookings yet this month"
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard label="Providers" value={stats.providerCount} icon="users" />
          <StatCard
            label="Average rating"
            value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
            icon="star"
            hint={`${stats.newThisWeek} joined in the last week`}
          />
        </div>
      </div>

      {categories.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Available here" />
          <CategoryRail categories={categories} />
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
                isFavorite={favoriteIds.has(card.providerId)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
