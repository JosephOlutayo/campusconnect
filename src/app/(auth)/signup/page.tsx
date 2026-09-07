import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiGet, apiGetOrNull, getSessionUser } from "@/lib/api";
import type { University } from "@/lib/types";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");

  const universities = await apiGet<University[]>("/api/universities");
  // With no mail server configured, telling people to use a campus email so
  // they can confirm it would be a promise the deployment cannot keep.
  const settings = await apiGetOrNull<{ emailVerificationEnabled?: boolean }>(
    "/api/stats/settings",
  );

  return (
    <SignupForm
      emailVerificationEnabled={settings?.emailVerificationEnabled ?? false}
      universities={universities.map((university) => ({
        id: university.id,
        name: university.name,
        shortName: university.shortName,
      }))}
    />
  );
}
