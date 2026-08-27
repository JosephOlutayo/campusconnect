import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { bookingSchema } from "@/lib/validation";
import { createAppointment } from "@/lib/booking";
import { isSlotBookable } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in to book an appointment.", 401);

    const body = bookingSchema.parse(await readJson(request));

    const service = await prisma.service.findUnique({
      where: { id: body.serviceId },
      select: { durationMinutes: true, providerId: true },
    });
    if (!service) throw new ApiError("Service not found.", 404);

    // Cheap pre-flight so the common "slot went stale" case returns a friendly
    // message; createAppointment still re-checks inside its transaction, which
    // is what actually guarantees no double booking.
    const bookable = await isSlotBookable(
      service.providerId,
      service.durationMinutes,
      body.startAt,
    );
    if (!bookable.ok) throw new ApiError(bookable.reason, 409);

    const appointment = await createAppointment({
      customerId: user.id,
      serviceId: body.serviceId,
      startAt: body.startAt,
      locationMode: body.locationMode,
      customerNote: body.customerNote,
      customerLocationHint: body.customerLocationHint,
      promoCode: body.promoCode,
    });

    return ok(
      {
        id: appointment.id,
        code: appointment.code,
        status: appointment.status,
        startAt: appointment.startAt.toISOString(),
      },
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
