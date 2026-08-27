import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { handleError, ok, readJson, ApiError } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { matchUniversityByEmail } from "@/lib/verification";

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await readJson(request));

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ApiError("An account with that email already exists. Try signing in.", 409);
    }

    const university = await prisma.university.findUnique({ where: { id: body.universityId } });
    if (!university) throw new ApiError("Pick a university from the list.", 422);

    // A .edu address matching this campus is auto-verified as a student. Any
    // other address still gets an account, just without the student badge.
    const domainMatch = await matchUniversityByEmail(body.email);
    const studentVerified = domainMatch?.id === university.id;

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        name: body.name,
        universityId: university.id,
        avatarSeed: `${body.name}-${Math.random().toString(36).slice(2, 8)}`,
        studentVerifiedAt: studentVerified ? new Date() : null,
        emailVerifiedAt: studentVerified ? new Date() : null,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    await createSession(user.id);

    return ok(
      {
        user,
        studentVerified,
        next: body.intent === "PROVIDER" ? "/provider/onboarding" : "/",
      },
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
