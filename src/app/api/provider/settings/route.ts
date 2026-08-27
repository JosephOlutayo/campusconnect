import { handleError, ok, readJson } from "@/lib/api";
import { apiProvider } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { providerSettingsSchema } from "@/lib/validation";
import { serializeList } from "@/lib/constants";

export async function PATCH(request: Request) {
  try {
    const { providerId } = await apiProvider();
    const body = providerSettingsSchema.parse(await readJson(request));

    await prisma.providerProfile.update({
      where: { id: providerId },
      data: {
        businessName: body.businessName,
        tagline: body.tagline ?? null,
        bio: body.bio,
        locationLabel: body.locationLabel,
        exactAddress: body.exactAddress ?? null,
        locationModes: serializeList(body.locationModes),
        autoConfirmBookings: body.autoConfirmBookings,
        bufferMinutes: body.bufferMinutes,
        minNoticeMinutes: body.minNoticeMinutes,
        maxAdvanceDays: body.maxAdvanceDays,
        cancellationPolicy: body.cancellationPolicy,
        status: body.status,
      },
    });

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
