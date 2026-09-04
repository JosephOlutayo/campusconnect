import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiGet, getSessionUser } from "@/lib/api";
import type { University } from "@/lib/types";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");

  const universities = await apiGet<University[]>("/api/universities");

  return (
    <SignupForm
      universities={universities.map((university) => ({
        id: university.id,
        name: university.name,
        shortName: university.shortName,
      }))}
    />
  );
}
