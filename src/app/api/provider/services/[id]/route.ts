import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiProvider } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validation";
import { serializeList } from "@/lib/constants";
import { dollarsToCents } from "@/lib/money";

async function ownedService(serviceId: string, providerId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, providerId: true },
  });
  if (!service || service.providerId !== providerId) throw new ApiError("Service not found.", 404);
  return service;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { providerId } = await apiProvider();
    const { id } = await context.params;
    await ownedService(id, providerId);

    const body = serviceSchema.partial().parse(await readJson(request));

    await prisma.service.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.priceDollars !== undefined
          ? { priceCents: dollarsToCents(body.priceDollars) }
          : {}),
        ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
        ...(body.locationModes !== undefined
          ? { locationModes: serializeList(body.locationModes) }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { providerId } = await apiProvider();
    const { id } = await context.params;
    await ownedService(id, providerId);

    // Past appointments reference the service for their price/title history, so
    // a service with any booking is retired rather than deleted.
    const bookings = await prisma.appointment.count({ where: { serviceId: id } });
    if (bookings > 0) {
      await prisma.service.update({ where: { id }, data: { isActive: false } });
      return ok({ archived: true });
    }

    await prisma.service.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
