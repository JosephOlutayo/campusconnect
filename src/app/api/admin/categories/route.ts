import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await apiAdmin();
    const body = categorySchema.parse(await readJson(request));

    const existing = await prisma.category.findUnique({ where: { slug: body.slug } });
    if (existing) throw new ApiError("A category with that slug already exists.", 409);

    const count = await prisma.category.count();
    const category = await prisma.category.create({
      data: { ...body, sortOrder: count },
    });

    return ok({ id: category.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await apiAdmin();
    const payload = await readJson<{ id: string; isActive?: boolean }>(request);
    if (!payload.id) throw new ApiError("id is required.", 422);

    await prisma.category.update({
      where: { id: payload.id },
      data: { ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}) },
    });

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
