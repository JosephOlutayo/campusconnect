import { prisma } from "@/lib/prisma";
import { addDays, endOfDay, startOfDay, startOfMonth } from "@/lib/time";

/**
 * Everything the provider dashboard, analytics and earnings screens need.
 * Kept together so the three pages cannot disagree about what "this month"
 * means or whether cancelled bookings count.
 */
export async function getProviderStats(providerId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    todays,
    upcoming,
    pending,
    completedThisMonth,
    earnedThisMonth,
    earnedAllTime,
    profile,
    lastMonthCompleted,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        providerId,
        startAt: { gte: todayStart, lte: todayEnd },
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      },
      orderBy: { startAt: "asc" },
      include: {
        service: { select: { title: true, durationMinutes: true } },
        customer: { select: { id: true, name: true, avatarSeed: true } },
      },
    }),
    prisma.appointment.count({
      where: { providerId, status: "CONFIRMED", startAt: { gt: now } },
    }),
    prisma.appointment.count({ where: { providerId, status: "PENDING" } }),
    prisma.appointment.count({
      where: { providerId, status: "COMPLETED", completedAt: { gte: monthStart } },
    }),
    prisma.appointment.aggregate({
      where: { providerId, status: "COMPLETED", completedAt: { gte: monthStart } },
      _sum: { providerPayoutCents: true },
    }),
    prisma.appointment.aggregate({
      where: { providerId, status: "COMPLETED" },
      _sum: { providerPayoutCents: true, platformFeeCents: true, priceCents: true },
    }),
    prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { ratingAvg: true, ratingCount: true, completedBookings: true, status: true },
    }),
    prisma.appointment.count({
      where: {
        providerId,
        status: "COMPLETED",
        completedAt: { gte: addDays(monthStart, -30), lt: monthStart },
      },
    }),
  ]);

  return {
    todays,
    upcoming,
    pending,
    completedThisMonth,
    lastMonthCompleted,
    earnedThisMonthCents: earnedThisMonth._sum.providerPayoutCents ?? 0,
    earnedAllTimeCents: earnedAllTime._sum.providerPayoutCents ?? 0,
    grossAllTimeCents: earnedAllTime._sum.priceCents ?? 0,
    feesAllTimeCents: earnedAllTime._sum.platformFeeCents ?? 0,
    ratingAvg: profile?.ratingAvg ?? 0,
    ratingCount: profile?.ratingCount ?? 0,
    completedBookings: profile?.completedBookings ?? 0,
    status: profile?.status ?? "ACTIVE",
  };
}

/** Completed bookings per week for the last `weeks` weeks, oldest first. */
export async function getWeeklyBookings(providerId: string, weeks = 4) {
  const now = new Date();
  const from = addDays(startOfDay(now), -7 * weeks);

  const appointments = await prisma.appointment.findMany({
    where: { providerId, startAt: { gte: from }, status: { not: "CANCELLED" } },
    select: { startAt: true, providerPayoutCents: true },
  });

  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(startOfDay(now), -7 * (weeks - index));
    const end = addDays(start, 7);
    const inWeek = appointments.filter(
      (appointment) => appointment.startAt >= start && appointment.startAt < end,
    );
    return {
      label: index === weeks - 1 ? "This wk" : `Wk ${index + 1}`,
      count: inWeek.length,
      payoutCents: inWeek.reduce((sum, appointment) => sum + appointment.providerPayoutCents, 0),
    };
  });
}

/** Which services actually earn — used by the analytics screen. */
export async function getServicePerformance(providerId: string) {
  const services = await prisma.service.findMany({
    where: { providerId },
    select: { id: true, title: true, priceCents: true, isActive: true },
  });

  const appointments = await prisma.appointment.groupBy({
    by: ["serviceId"],
    where: { providerId, status: "COMPLETED" },
    _count: { _all: true },
    _sum: { providerPayoutCents: true },
  });

  const byService = new Map(appointments.map((row) => [row.serviceId, row]));

  return services
    .map((service) => ({
      ...service,
      completed: byService.get(service.id)?._count._all ?? 0,
      earnedCents: byService.get(service.id)?._sum.providerPayoutCents ?? 0,
    }))
    .sort((a, b) => b.earnedCents - a.earnedCents);
}
