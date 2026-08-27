import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseLocationModes } from "@/lib/constants";
import { distanceMiles } from "@/lib/geo";
import { getNextAvailableForProviders } from "@/lib/availability";
import type { ProviderCard as Card } from "@/lib/search";

import { PageHeader } from "@/components/shell/PageHeader";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Saved providers" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser();

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      provider: {
        include: {
          user: { select: { avatarSeed: true } },
          university: { select: { shortName: true, slug: true, latitude: true, longitude: true } },
          portfolio: { select: { seed: true }, orderBy: { sortOrder: "asc" }, take: 3 },
          services: {
            where: { isActive: true },
            orderBy: { priceCents: "asc" },
            include: { category: { select: { name: true, icon: true } } },
          },
          _count: { select: { services: true } },
        },
      },
    },
  });

  const withServices = favorites.filter((favorite) => favorite.provider.services.length > 0);

  const nextAvailable = await getNextAvailableForProviders(
    withServices.map((favorite) => ({
      providerId: favorite.provider.id,
      durationMinutes: favorite.provider.services.reduce((best, service) =>
        service.bookingCount > best.bookingCount ? service : best,
      ).durationMinutes,
    })),
  );

  const cards: Card[] = withServices.map((favorite) => {
    const provider = favorite.provider;
    // Same headline rule as search: what they are known for, not the cheapest.
    const headline = provider.services.reduce((best, service) =>
      service.bookingCount > best.bookingCount ? service : best,
    );
    const fromPriceCents = Math.min(...provider.services.map((service) => service.priceCents));
    return {
      providerId: provider.id,
      slugId: provider.id,
      businessName: provider.businessName,
      tagline: provider.tagline,
      avatarSeed: provider.user.avatarSeed,
      isVerified: provider.isVerified,
      ratingAvg: provider.ratingAvg,
      ratingCount: provider.ratingCount,
      completedBookings: provider.completedBookings,
      universityShortName: provider.university.shortName,
      universitySlug: provider.university.slug,
      locationLabel: provider.locationLabel,
      locationModes: parseLocationModes(provider.locationModes),
      distanceMiles: distanceMiles(
        { latitude: provider.university.latitude, longitude: provider.university.longitude },
        { latitude: provider.latitude, longitude: provider.longitude },
      ),
      headlineService: {
        id: headline.id,
        title: headline.title,
        priceCents: headline.priceCents,
        durationMinutes: headline.durationMinutes,
        categoryName: headline.category.name,
        categoryIcon: headline.category.icon,
      },
      headlineBookings: headline.bookingCount,
      serviceCount: provider._count.services,
      fromPriceCents,
      portfolioSeeds: provider.portfolio.map((image) => image.seed),
      nextAvailable: nextAvailable.get(provider.id) ?? null,
      createdAt: provider.createdAt,
    };
  });

  return (
    <>
      <PageHeader
        title="Saved providers"
        subtitle={`${cards.length} provider${cards.length === 1 ? "" : "s"} you have saved`}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon="❤️"
          title="Nothing saved yet"
          description="Tap the heart on any provider to keep them here for later."
          action={<ButtonLink href="/explore">Browse providers</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <ProviderCard key={card.providerId} card={card} isFavorite />
          ))}
        </div>
      )}
    </>
  );
}
