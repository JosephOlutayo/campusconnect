import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiGetOrNull, getSessionUser } from "@/lib/api";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? There is nothing here for you.
  if (await getSessionUser()) redirect("/");

  // The one-tap demo logins are only worth showing while those accounts exist.
  const settings = await apiGetOrNull<{ demoAccountsAvailable?: boolean }>("/api/stats/settings");
  return <LoginForm showDemoAccounts={settings?.demoAccountsAvailable ?? false} />;
}
