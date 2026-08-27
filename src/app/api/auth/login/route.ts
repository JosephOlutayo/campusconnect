import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await readJson(request));

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        isSuspended: true,
        providerProfile: { select: { id: true } },
      },
    });

    const valid = await verifyPassword(body.password, user?.passwordHash ?? null);
    // Same message either way — never confirm which half was wrong.
    if (!user || !valid) throw new ApiError("That email and password do not match.", 401);
    if (user.isSuspended) {
      throw new ApiError("This account is suspended. Contact support@campusconnect.app", 403);
    }

    await createSession(user.id);

    return ok({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      next: user.role === "ADMIN" ? "/admin" : user.providerProfile ? "/provider" : "/",
    });
  } catch (error) {
    return handleError(error);
  }
}
