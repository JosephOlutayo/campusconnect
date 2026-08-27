import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validation";

/**
 * Resolves the account behind whatever was reported, so an admin can act on the
 * user without chasing the target through three tables.
 */
async function resolveTargetUser(targetType: string, targetId: string): Promise<string | null> {
  switch (targetType) {
    case "USER":
      return targetId;
    case "PROVIDER": {
      const provider = await prisma.providerProfile.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return provider?.userId ?? null;
    }
    case "SERVICE": {
      const service = await prisma.service.findUnique({
        where: { id: targetId },
        select: { provider: { select: { userId: true } } },
      });
      return service?.provider.userId ?? null;
    }
    case "REVIEW": {
      const review = await prisma.review.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      return review?.authorId ?? null;
    }
    case "MESSAGE": {
      const message = await prisma.message.findUnique({
        where: { id: targetId },
        select: { senderId: true },
      });
      return message?.senderId ?? null;
    }
    default:
      return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in to report.", 401);

    const body = reportSchema.parse(await readJson(request));
    const targetUserId = await resolveTargetUser(body.targetType, body.targetId);

    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: body.targetType,
        targetId: body.targetId,
        targetUserId,
        reason: body.reason,
        details: body.details ?? null,
      },
    });

    return ok({ submitted: true }, 201);
  } catch (error) {
    return handleError(error);
  }
}
