import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { universitySchema } from "@/lib/validation";
import { parseList } from "@/lib/constants";

/**
 * Adding a campus is pure data entry — no code change, no deploy. That is what
 * makes "scale from one university to hundreds" a real claim rather than a
 * refactor waiting to happen.
 */
export async function POST(request: Request) {
  try {
    await apiAdmin();
    const body = universitySchema.parse(await readJson(request));

    const existing = await prisma.university.findUnique({ where: { slug: body.slug } });
    if (existing) throw new ApiError("A campus with that slug already exists.", 409);

    const domains = parseList(body.emailDomains).map((domain) => domain.toLowerCase());
    const taken = await prisma.universityEmailDomain.findMany({
      where: { domain: { in: domains } },
      select: { domain: true },
    });
    if (taken.length > 0) {
      throw new ApiError(
        `Already assigned to another campus: ${taken.map((row) => row.domain).join(", ")}`,
        409,
      );
    }

    const university = await prisma.university.create({
      data: {
        name: body.name,
        shortName: body.shortName,
        slug: body.slug,
        city: body.city,
        state: body.state,
        latitude: body.latitude,
        longitude: body.longitude,
        color: body.color,
        emailDomains: { create: domains.map((domain) => ({ domain })) },
      },
    });

    return ok({ id: university.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await apiAdmin();
    const payload = await readJson<{ id: string; isActive?: boolean }>(request);
    if (!payload.id) throw new ApiError("id is required.", 422);

    await prisma.university.update({
      where: { id: payload.id },
      data: { ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}) },
    });

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
