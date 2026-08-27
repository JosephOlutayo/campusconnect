import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiProvider } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { timeOffSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { providerId } = await apiProvider();
    const body = timeOffSchema.parse(await readJson(request));

    if (body.endAt <= body.startAt) throw new ApiError("The block must end after it starts.", 422);

    // Blocking time does not silently drop existing bookings — surface the
    // clash so the provider decides what to do about them.
    const conflicts = await prisma.appointment.count({
      where: {
        providerId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: body.endAt },
        blockEndAt: { gt: body.startAt },
      },
    });

    const timeOff = await prisma.timeOff.create({
      data: {
        providerId,
        startAt: body.startAt,
        endAt: body.endAt,
        reason: body.reason ?? null,
      },
    });

    return ok({ id: timeOff.id, conflictingAppointments: conflicts }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { providerId } = await apiProvider();
    const { id } = await readJson<{ id: string }>(request);
    await prisma.timeOff.deleteMany({ where: { id, providerId } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
