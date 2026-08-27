import { prisma } from "@/lib/prisma";
import { ApiError, handleError, ok } from "@/lib/api";
import { getDaySlots, getOpenDays } from "@/lib/availability";
import { addDays, isValidDateKey, toDateKey } from "@/lib/time";

/**
 * GET /api/availability?serviceId=...&date=YYYY-MM-DD
 *   -> bookable start times for that day
 * GET /api/availability?serviceId=...&from=YYYY-MM-DD&days=30
 *   -> which days in the window have any opening (drives the calendar dots)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceId = url.searchParams.get("serviceId");
    if (!serviceId) throw new ApiError("serviceId is required.", 422);

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { durationMinutes: true, providerId: true, isActive: true },
    });
    if (!service || !service.isActive) throw new ApiError("Service not found.", 404);

    const excludeAppointmentId = url.searchParams.get("exclude") ?? undefined;
    const date = url.searchParams.get("date");

    if (date) {
      if (!isValidDateKey(date)) throw new ApiError("date must be YYYY-MM-DD.", 422);
      const slots = await getDaySlots(service.providerId, service.durationMinutes, date, {
        excludeAppointmentId,
      });
      return ok({
        date,
        slots: slots.map((slot) => ({
          startAt: slot.startAt.toISOString(),
          endAt: slot.endAt.toISOString(),
        })),
      });
    }

    const fromParam = url.searchParams.get("from");
    const from = fromParam && isValidDateKey(fromParam) ? new Date(`${fromParam}T00:00:00`) : new Date();
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30)));

    const openDays = await getOpenDays(service.providerId, service.durationMinutes, from, days);
    return ok({
      from: toDateKey(from),
      to: toDateKey(addDays(from, days)),
      openDays: Array.from(openDays),
    });
  } catch (error) {
    return handleError(error);
  }
}
