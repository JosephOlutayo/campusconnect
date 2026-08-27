import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { recomputeProviderRating } from "@/lib/reviews";

type Body = { action: "hide" | "unhide" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await apiAdmin();
    const { id } = await context.params;
    const body = await readJson<Body>(request);

    const review = await prisma.review.findUnique({
      where: { id },
      select: { providerId: true },
    });
    if (!review) throw new ApiError("Review not found.", 404);

    if (body.action !== "hide" && body.action !== "unhide") {
      throw new ApiError("Unknown action.", 422);
    }

    await prisma.review.update({
      where: { id },
      data: { isHidden: body.action === "hide" },
    });
    // Hiding a review must move the provider's public average with it.
    await recomputeProviderRating(review.providerId);

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
