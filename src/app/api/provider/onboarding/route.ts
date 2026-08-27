import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { providerOnboardingSchema } from "@/lib/validation";
import { serializeList } from "@/lib/constants";
import { dollarsToCents } from "@/lib/money";
import { getProviderAutoApprove } from "@/lib/settings";
import { approximate } from "@/lib/geo";

/**
 * Creates the provider profile, their first service, a sensible default week of
 * availability, and promotes the account to the PROVIDER role — one
 * transaction, so a half-built business can never exist.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);
    if (user.providerProfile) throw new ApiError("You already have a provider profile.", 409);
    if (!user.universityId) throw new ApiError("Add your university before offering services.", 422);

    const body = providerOnboardingSchema.parse(await readJson(request));
    const autoApprove = await getProviderAutoApprove();

    const university = await prisma.university.findUniqueOrThrow({
      where: { id: user.universityId },
      select: { latitude: true, longitude: true },
    });
    // Providers are placed near their campus with a deliberate blur; an exact
    // home address is never used for the public map position.
    const point = approximate(
      { latitude: university.latitude, longitude: university.longitude },
      user.id,
    );

    const providerId = await prisma.$transaction(async (tx) => {
      const profile = await tx.providerProfile.create({
        data: {
          userId: user.id,
          businessName: body.businessName,
          tagline: body.tagline ?? null,
          bio: body.bio,
          universityId: user.universityId!,
          locationLabel: body.locationLabel,
          exactAddress: body.exactAddress ?? null,
          latitude: point.latitude,
          longitude: point.longitude,
          locationModes: serializeList(body.locationModes),
          status: autoApprove ? "ACTIVE" : "PENDING",
        },
      });

      await tx.service.create({
        data: {
          providerId: profile.id,
          categoryId: body.categoryId,
          title: body.serviceTitle,
          description: body.serviceDescription,
          priceCents: dollarsToCents(body.priceDollars),
          durationMinutes: body.durationMinutes,
          locationModes: serializeList(body.locationModes),
        },
      });

      // Monday–Friday, 10am–6pm. Editable immediately, but it means a brand new
      // provider is bookable the moment they finish onboarding.
      await tx.availabilityRule.createMany({
        data: [1, 2, 3, 4, 5].map((weekday) => ({
          providerId: profile.id,
          weekday,
          startMinute: 10 * 60,
          endMinute: 18 * 60,
        })),
      });

      await tx.user.update({ where: { id: user.id }, data: { role: "PROVIDER" } });

      return profile.id;
    });

    return ok({ providerId, status: autoApprove ? "ACTIVE" : "PENDING" }, 201);
  } catch (error) {
    return handleError(error);
  }
}
