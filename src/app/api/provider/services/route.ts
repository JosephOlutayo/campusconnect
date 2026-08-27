import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validation";
import { serializeList } from "@/lib/constants";
import { dollarsToCents } from "@/lib/money";

async function requireProviderId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new ApiError("Sign in first.", 401);
  if (!user.providerProfile) throw new ApiError("Create a provider profile first.", 403);
  return user.providerProfile.id;
}

export async function GET() {
  try {
    const providerId = await requireProviderId();
    const services = await prisma.service.findMany({
      where: { providerId },
      include: { category: { select: { name: true, icon: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ services });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const providerId = await requireProviderId();
    const body = serviceSchema.parse(await readJson(request));

    const service = await prisma.service.create({
      data: {
        providerId,
        categoryId: body.categoryId,
        title: body.title,
        description: body.description,
        priceCents: dollarsToCents(body.priceDollars),
        durationMinutes: body.durationMinutes,
        locationModes: serializeList(body.locationModes),
        isActive: body.isActive,
      },
    });

    return ok({ id: service.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
