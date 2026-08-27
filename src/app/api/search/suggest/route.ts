import { getSessionUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { suggest } from "@/lib/search";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    // Signed-in students see their own campus first; guests see everything.
    const user = await getSessionUser();
    const universityId = url.searchParams.get("all") ? undefined : (user?.universityId ?? undefined);

    return ok(await suggest(q, universityId));
  } catch (error) {
    return handleError(error);
  }
}
