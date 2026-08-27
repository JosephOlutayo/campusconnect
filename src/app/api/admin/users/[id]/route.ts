import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type Body = { action: "suspend" | "reinstate" | "make_admin" | "revoke_admin"; note?: string };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await apiAdmin();
    const { id } = await context.params;
    const body = await readJson<Body>(request);

    // An admin locking themselves out is not a recoverable state in this app.
    if (id === admin.id && (body.action === "suspend" || body.action === "revoke_admin")) {
      throw new ApiError("You cannot do that to your own account.", 400);
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw new ApiError("User not found.", 404);

    switch (body.action) {
      case "suspend":
        await prisma.$transaction([
          prisma.user.update({
            where: { id },
            data: { isSuspended: true, suspendedNote: body.note?.trim() || null },
          }),
          // Suspending a user must also pull their listings out of search.
          prisma.providerProfile.updateMany({
            where: { userId: id },
            data: { status: "SUSPENDED" },
          }),
        ]);
        break;
      case "reinstate":
        await prisma.$transaction([
          prisma.user.update({
            where: { id },
            data: { isSuspended: false, suspendedNote: null, suspendedUntil: null },
          }),
          prisma.providerProfile.updateMany({
            where: { userId: id, status: "SUSPENDED" },
            data: { status: "ACTIVE" },
          }),
        ]);
        break;
      case "make_admin":
        await prisma.user.update({ where: { id }, data: { role: "ADMIN" } });
        break;
      case "revoke_admin": {
        const hasProfile = await prisma.providerProfile.count({ where: { userId: id } });
        await prisma.user.update({
          where: { id },
          data: { role: hasProfile > 0 ? "PROVIDER" : "STUDENT" },
        });
        break;
      }
      default:
        throw new ApiError("Unknown action.", 422);
    }

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
