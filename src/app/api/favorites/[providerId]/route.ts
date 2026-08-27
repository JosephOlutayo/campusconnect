import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ providerId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in to save providers.", 401);
    const { providerId } = await context.params;

    // Upsert keeps a double-tap idempotent instead of throwing on the unique.
    await prisma.favorite.upsert({
      where: { userId_providerId: { userId: user.id, providerId } },
      update: {},
      create: { userId: user.id, providerId },
    });

    return ok({ saved: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);
    const { providerId } = await context.params;

    await prisma.favorite.deleteMany({ where: { userId: user.id, providerId } });
    return ok({ saved: false });
  } catch (error) {
    return handleError(error);
  }
}
