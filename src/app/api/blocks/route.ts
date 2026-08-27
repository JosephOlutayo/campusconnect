import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const { userId } = await readJson<{ userId: string }>(request);
    if (!userId || userId === user.id) throw new ApiError("Pick someone to block.", 422);

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
      update: {},
      create: { blockerId: user.id, blockedId: userId },
    });

    return ok({ blocked: true }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const { userId } = await readJson<{ userId: string }>(request);
    await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: userId } });
    return ok({ blocked: false });
  } catch (error) {
    return handleError(error);
  }
}
