import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/api";

/**
 * Page-level access guards.
 *
 * These mirror the checks the Java API already enforces — the API is the real
 * boundary, and these exist so a signed-out visitor gets a login redirect
 * instead of a page full of empty panels.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Provider pages need both an account and a created business profile. */
export async function requireProvider(): Promise<SessionUser & { providerProfileId: string }> {
  const user = await requireUser();
  if (!user.providerProfileId) redirect("/provider/onboarding");
  return user as SessionUser & { providerProfileId: string };
}
