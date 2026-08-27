import { prisma } from "@/lib/prisma";
import { addDays, startOfDay, startOfMonth } from "@/lib/time";

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { services: { where: { isActive: true } } } } },
  });
}

export async function getUniversities() {
  return prisma.university.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { providers: true } } },
  });
}

/** Provider ids the user has saved, as a Set for O(1) card lookups. */
export async function getFavoriteIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: { providerId: true },
  });
  return new Set(favorites.map((favorite) => favorite.providerId));
}

export async function getUpcomingAppointments(userId: string, take = 5) {
  return prisma.appointment.findMany({
    where: {
      customerId: userId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: new Date() },
    },
    orderBy: { startAt: "asc" },
    take,
    include: {
      service: { select: { title: true, durationMinutes: true } },
      provider: {
        select: {
          id: true,
          businessName: true,
          locationLabel: true,
          user: { select: { avatarSeed: true } },
        },
      },
    },
  });
}

export async function getPastAppointments(userId: string, take = 20) {
  return prisma.appointment.findMany({
    where: {
      customerId: userId,
      OR: [{ status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } }, { startAt: { lt: new Date() } }],
    },
    orderBy: { startAt: "desc" },
    take,
    include: {
      service: { select: { title: true } },
      review: { select: { id: true, rating: true } },
      provider: {
        select: { id: true, businessName: true, user: { select: { avatarSeed: true } } },
      },
    },
  });
}

/**
 * Bookings per category on one campus this month — the series behind the
 * home page hero chart. Grouping in SQL then joining names in memory keeps it
 * to two queries regardless of how many categories exist.
 */
export async function getCampusActivity(universityId: string | null) {
  const since = startOfMonth(new Date());

  const services = await prisma.service.findMany({
    where: universityId ? { provider: { universityId } } : {},
    select: { id: true, categoryId: true },
  });
  const categoryByService = new Map(services.map((service) => [service.id, service.categoryId]));

  const appointments = await prisma.appointment.findMany({
    where: {
      createdAt: { gte: since },
      serviceId: { in: services.map((service) => service.id) },
      status: { not: "CANCELLED" },
    },
    select: { serviceId: true },
  });

  const totals = new Map<string, number>();
  for (const appointment of appointments) {
    const categoryId = categoryByService.get(appointment.serviceId);
    if (!categoryId) continue;
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + 1);
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: Array.from(totals.keys()) } },
    select: { id: true, name: true, icon: true },
  });
  const nameById = new Map(categories.map((category) => [category.id, category]));

  const ranked = Array.from(totals.entries())
    .map(([categoryId, count]) => ({
      name: nameById.get(categoryId)?.name ?? "Other",
      icon: nameById.get(categoryId)?.icon ?? "✨",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return { total: appointments.length, ranked };
}

/** Headline numbers for the campus a student belongs to. */
export async function getCampusStats(universityId: string | null) {
  const where = universityId ? { universityId, status: "ACTIVE" } : { status: "ACTIVE" };

  const [providerCount, serviceCount, ratingAgg, newThisWeek] = await Promise.all([
    prisma.providerProfile.count({ where }),
    prisma.service.count({ where: { isActive: true, provider: where } }),
    prisma.providerProfile.aggregate({
      where: { ...where, ratingCount: { gt: 0 } },
      _avg: { ratingAvg: true },
    }),
    prisma.providerProfile.count({
      where: { ...where, createdAt: { gte: addDays(startOfDay(new Date()), -7) } },
    }),
  ]);

  return {
    providerCount,
    serviceCount,
    averageRating: Math.round((ratingAgg._avg.ratingAvg ?? 0) * 10) / 10,
    newThisWeek,
  };
}
