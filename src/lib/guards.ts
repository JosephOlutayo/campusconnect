import { getSessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";

/** API-route equivalents of the page-level guards in lib/auth.ts. */

export async function apiUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError("Sign in first.", 401);
  return user;
}

export async function apiProvider() {
  const user = await apiUser();
  if (!user.providerProfile) throw new ApiError("Create a provider profile first.", 403);
  return { user, providerId: user.providerProfile.id };
}

export async function apiAdmin() {
  const user = await apiUser();
  if (user.role !== "ADMIN") throw new ApiError("Admins only.", 403);
  return user;
}
