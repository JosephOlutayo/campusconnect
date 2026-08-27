import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  declineAppointment,
  markNoShow,
  rescheduleAppointment,
} from "@/lib/booking";
import { isSlotBookable } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

type Body = {
  action: "confirm" | "decline" | "cancel" | "complete" | "no_show" | "reschedule";
  reason?: string;
  startAt?: string;
};

/**
 * Every state transition on an appointment goes through one endpoint keyed on
 * `action`, so authorisation and notification live in one place instead of six
 * near-identical routes.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const { id } = await context.params;
    const body = await readJson<Body>(request);

    switch (body.action) {
      case "confirm":
        return ok(await confirmAppointment(id, user.id));
      case "decline":
        return ok(await declineAppointment(id, user.id, body.reason));
      case "cancel":
        return ok(await cancelAppointment(id, user.id, body.reason));
      case "complete":
        return ok(await completeAppointment(id, user.id));
      case "no_show":
        return ok(await markNoShow(id, user.id));
      case "reschedule": {
        if (!body.startAt) throw new ApiError("startAt is required to reschedule.", 422);
        const startAt = new Date(body.startAt);
        if (Number.isNaN(startAt.getTime())) throw new ApiError("Invalid startAt.", 422);

        const appointment = await prisma.appointment.findUnique({
          where: { id },
          select: { providerId: true, service: { select: { durationMinutes: true } } },
        });
        if (!appointment) throw new ApiError("Appointment not found.", 404);

        const bookable = await isSlotBookable(
          appointment.providerId,
          appointment.service.durationMinutes,
          startAt,
          { excludeAppointmentId: id },
        );
        if (!bookable.ok) throw new ApiError(bookable.reason, 409);

        return ok(await rescheduleAppointment(id, user.id, startAt));
      }
      default:
        throw new ApiError("Unknown action.", 422);
    }
  } catch (error) {
    return handleError(error);
  }
}
