import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validation";
import { matchUniversityByEmail } from "@/lib/verification";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const body = profileSchema.parse(await readJson(request));

    const university = await prisma.university.findUnique({ where: { id: body.universityId } });
    if (!university) throw new ApiError("Pick a university from the list.", 422);

    // Switching campuses re-evaluates the student badge: it only holds while
    // the verified email domain still belongs to the selected university.
    const domainMatch = await matchUniversityByEmail(user.email);
    const keepsStudentBadge = Boolean(user.studentVerifiedAt) && domainMatch?.id === university.id;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        bio: body.bio ?? null,
        phone: body.phone ?? null,
        universityId: university.id,
        studentVerifiedAt: keepsStudentBadge ? user.studentVerifiedAt : null,
      },
    });

    return ok({ updated: true, studentVerified: keepsStudentBadge });
  } catch (error) {
    return handleError(error);
  }
}
