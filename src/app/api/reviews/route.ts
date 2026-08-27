import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { reviewSchema } from "@/lib/validation";
import { createReview } from "@/lib/reviews";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const body = reviewSchema.parse(await readJson(request));
    const review = await createReview({
      appointmentId: body.appointmentId,
      authorId: user.id,
      rating: body.rating,
      body: body.body,
      imageSeeds: body.imageSeeds,
    });

    return ok({ id: review.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
