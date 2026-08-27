import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { markNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({ notifications });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const body = await readJson<{ ids?: string[] }>(request).catch(() => ({ ids: undefined }));
    const count = await markNotificationsRead(user.id, body.ids);
    return ok({ read: count });
  } catch (error) {
    return handleError(error);
  }
}
