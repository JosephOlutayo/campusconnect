import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { reviewResponseSchema } from "@/lib/validation";
import { respondToReview } from "@/lib/reviews";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const { id } = await context.params;
    const body = reviewResponseSchema.parse(await readJson(request));

    await respondToReview(id, user.id, body.response);
    return ok({ responded: true });
  } catch (error) {
    return handleError(error);
  }
}
