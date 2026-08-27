import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already signed in? There is nothing here for you.
  if (await getSessionUser()) redirect("/");
  return <LoginForm />;
}
