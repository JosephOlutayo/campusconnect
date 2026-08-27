import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getUniversities } from "@/lib/queries";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");

  const universities = await getUniversities();

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
