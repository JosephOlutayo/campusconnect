import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseList, parseLocationModes, type LocationMode } from "@/lib/constants";
import { distanceMiles } from "@/lib/geo";
import { getNextAvailableForProviders } from "@/lib/availability";
import { addDays, isSameDay, startOfDay } from "@/lib/time";

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "distance", label: "Closest" },
  { value: "booked", label: "Most booked" },
  { value: "newest", label: "Newest" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const AVAILABILITY_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
] as const;

export type SearchParams = {
  q?: string;
  categorySlug?: string;
  universityId?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  minRating?: number;
  locationModes?: LocationMode[];
  availability?: "any" | "today" | "week";
  sort?: SortOption;
  verifiedOnly?: boolean;
  page?: number;
  perPage?: number;
};

export type ProviderCard = {
  providerId: string;
  slugId: string;
  businessName: string;
  tagline: string | null;
  avatarSeed: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedBookings: number;
  universityShortName: string;
  universitySlug: string;
  locationLabel: string;
  locationModes: LocationMode[];
  distanceMiles: number | null;
  headlineService: {
    id: string;
    title: string;
    priceCents: number;
    durationMinutes: number;
    categoryName: string;
    categoryIcon: string;
  };
  /** Internal: how the headline was chosen. Not rendered. */
  headlineBookings: number;
  serviceCount: number;
  fromPriceCents: number;
  portfolioSeeds: string[];
  nextAvailable: Date | null;
  createdAt: Date;
};

/**
 * Normalises a raw query into tokens plus any category the phrase implies.
 * "math tutor" -> tokens [math, tutor] and the Tutoring category, because the
 * category carries "tutor" in its keyword list.
 */
export async function interpretQuery(q: string | undefined) {
  const raw = (q ?? "").trim().toLowerCase();
  if (!raw) return { tokens: [] as string[], categoryIds: [] as string[], raw };

  const tokens = raw.split(/\s+/).filter((t) => t.length > 1);
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, keywords: true },
  });

  const categoryIds = categories
    .filter((category) => {
      const haystack = [
        category.name.toLowerCase(),
        category.slug.toLowerCase(),
        ...parseList(category.keywords).map((k) => k.toLowerCase()),
      ];
      return tokens.some((token) =>
        haystack.some((entry) => entry.includes(token) || token.includes(entry)),
      );
    })
    .map((category) => category.id);

  return { tokens, categoryIds, raw };
}

/** Relevance heuristic. Swap for Postgres tsvector/pg_trgm when the catalogue grows. */
function relevanceScore(card: ProviderCard, tokens: string[], categoryIds: string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = `${card.businessName} ${card.tagline ?? ""} ${card.headlineService.title} ${card.headlineService.categoryName}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (card.businessName.toLowerCase().includes(token)) score += 6;
    if (card.headlineService.title.toLowerCase().includes(token)) score += 4;
    if (card.headlineService.categoryName.toLowerCase().includes(token)) score += 3;
    if (haystack.includes(token)) score += 1;
  }
  if (categoryIds.length > 0) score += 2;
  return score;
}

/** Bayesian-ish ranking so one 5-star review does not outrank forty 4.8s. */
function recommendedScore(card: ProviderCard): number {
  const confidence = Math.log10(card.ratingCount + 1);
  return card.ratingAvg * (1 + confidence) + Math.log10(card.completedBookings + 1);
}

export async function searchProviders(params: SearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = params.perPage ?? 12;
  const { tokens, categoryIds } = await interpretQuery(params.q);

  const serviceWhere: Prisma.ServiceWhereInput = {
    isActive: true,
    provider: {
      status: "ACTIVE",
      ...(params.universityId ? { universityId: params.universityId } : {}),
      ...(params.minRating ? { ratingAvg: { gte: params.minRating } } : {}),
      ...(params.verifiedOnly ? { isVerified: true } : {}),
      user: { isSuspended: false },
    },
    ...(params.categorySlug ? { category: { slug: params.categorySlug } } : {}),
    ...(params.minPriceCents !== undefined || params.maxPriceCents !== undefined
      ? {
          priceCents: {
            ...(params.minPriceCents !== undefined ? { gte: params.minPriceCents } : {}),
            ...(params.maxPriceCents !== undefined ? { lte: params.maxPriceCents } : {}),
          },
        }
      : {}),
  };

  // Text match. SQLite LIKE is ASCII case-insensitive, which is why no
  // `mode: "insensitive"` appears here (Prisma rejects it on SQLite).
  if (tokens.length > 0) {
    serviceWhere.OR = [
      ...tokens.map((token) => ({ title: { contains: token } })),
      ...tokens.map((token) => ({ description: { contains: token } })),
      ...tokens.map((token) => ({ provider: { businessName: { contains: token } } })),
      ...tokens.map((token) => ({ provider: { tagline: { contains: token } } })),
      ...tokens.map((token) => ({ category: { name: { contains: token } } })),
      ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
    ];
  }

  const services = await prisma.service.findMany({
    where: serviceWhere,
    include: {
      category: { select: { name: true, icon: true, slug: true } },
      provider: {
        include: {
          user: { select: { avatarSeed: true, isSuspended: true } },
          university: { select: { shortName: true, slug: true, latitude: true, longitude: true } },
          portfolio: { select: { seed: true, url: true }, orderBy: { sortOrder: "asc" }, take: 4 },
          _count: { select: { services: true } },
        },
      },
    },
    // Bounded so one prolific provider cannot crowd out the page; the demo
    // catalogue fits comfortably inside this.
    take: 400,
  });

  // Collapse to one card per provider, keeping the cheapest matching service as
  // the headline (that is the "from $X" the card advertises).
  const byProvider = new Map<string, ProviderCard>();
  for (const service of services) {
    const provider = service.provider;
    if (provider.user.isSuspended) continue;

    const modes = parseLocationModes(
      service.locationModes || provider.locationModes,
    );
    if (params.locationModes?.length) {
      const wanted = params.locationModes;
      if (!modes.some((mode) => wanted.includes(mode))) continue;
    }

    const existing = byProvider.get(provider.id);
    if (existing) {
      // "from" is the cheapest match, but the headline is what they are known
      // for — the most-booked service. Picking the cheapest as the headline
      // makes a barber look like a $12 line-up shop.
      existing.fromPriceCents = Math.min(existing.fromPriceCents, service.priceCents);
      existing.serviceCount = existing.serviceCount;
      const better =
        service.bookingCount > existing.headlineBookings ||
        (service.bookingCount === existing.headlineBookings &&
          service.priceCents > existing.headlineService.priceCents);
      if (better) {
        existing.headlineBookings = service.bookingCount;
        existing.headlineService = {
          id: service.id,
          title: service.title,
          priceCents: service.priceCents,
          durationMinutes: service.durationMinutes,
          categoryName: service.category.name,
          categoryIcon: service.category.icon,
        };
      }
      continue;
    }

    byProvider.set(provider.id, {
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
      locationModes: modes,
      distanceMiles: distanceMiles(
        { latitude: provider.university.latitude, longitude: provider.university.longitude },
        { latitude: provider.latitude, longitude: provider.longitude },
      ),
      headlineService: {
        id: service.id,
        title: service.title,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
        categoryName: service.category.name,
        categoryIcon: service.category.icon,
      },
      headlineBookings: service.bookingCount,
      serviceCount: provider._count.services,
      fromPriceCents: service.priceCents,
      portfolioSeeds: provider.portfolio.map((image) => image.seed),
      nextAvailable: null,
      createdAt: provider.createdAt,
    });
  }

  let cards = Array.from(byProvider.values());

  // Next-available is needed for the card copy AND the availability filter, so
  // it is resolved once, in bulk, for the whole result set.
  const nextAvailable = await getNextAvailableForProviders(
    cards.map((card) => ({
      providerId: card.providerId,
      durationMinutes: card.headlineService.durationMinutes,
    })),
  );
  for (const card of cards) {
    card.nextAvailable = nextAvailable.get(card.providerId) ?? null;
  }

  if (params.availability === "today") {
    const today = new Date();
    cards = cards.filter((card) => card.nextAvailable && isSameDay(card.nextAvailable, today));
  } else if (params.availability === "week") {
    const limit = addDays(startOfDay(new Date()), 7);
    cards = cards.filter((card) => card.nextAvailable && card.nextAvailable <= limit);
  }

  const sort = params.sort ?? "recommended";
  cards.sort((a, b) => {
    switch (sort) {
      case "rating":
        return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
      case "price_asc":
        return a.fromPriceCents - b.fromPriceCents;
      case "price_desc":
        return b.fromPriceCents - a.fromPriceCents;
      case "distance":
        return (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999);
      case "booked":
        return b.completedBookings - a.completedBookings;
      case "newest":
        return b.createdAt.getTime() - a.createdAt.getTime();
      default: {
        if (tokens.length > 0) {
          const diff =
            relevanceScore(b, tokens, categoryIds) - relevanceScore(a, tokens, categoryIds);
          if (diff !== 0) return diff;
        }
        return recommendedScore(b) - recommendedScore(a);
      }
    }
  });

  const total = cards.length;
  const start = (page - 1) * perPage;
  return {
    cards: cards.slice(start, start + perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Lightweight typeahead: categories first, then providers, then services. */
export async function suggest(q: string, universityId?: string) {
  const term = q.trim();
  if (term.length < 2) return { categories: [], providers: [], services: [] };

  const [categories, providers, services] = await Promise.all([
    prisma.category.findMany({
      where: {
        isActive: true,
        OR: [{ name: { contains: term } }, { keywords: { contains: term } }],
      },
      select: { name: true, slug: true, icon: true },
      take: 4,
    }),
    prisma.providerProfile.findMany({
      where: {
        status: "ACTIVE",
        ...(universityId ? { universityId } : {}),
        OR: [{ businessName: { contains: term } }, { tagline: { contains: term } }],
      },
      select: {
        id: true,
        businessName: true,
        ratingAvg: true,
        user: { select: { avatarSeed: true } },
      },
      take: 4,
    }),
    prisma.service.findMany({
      where: {
        isActive: true,
        title: { contains: term },
        provider: { status: "ACTIVE", ...(universityId ? { universityId } : {}) },
      },
      select: {
        id: true,
        title: true,
        priceCents: true,
        provider: { select: { id: true, businessName: true } },
      },
      take: 4,
    }),
  ]);

  return { categories, providers, services };
}
