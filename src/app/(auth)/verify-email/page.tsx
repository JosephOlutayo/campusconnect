import type { Metadata } from "next";

import { VerifyEmail } from "@/components/auth/VerifyEmail";

export const metadata: Metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // Deliberately not redeemed here — see the note in VerifyEmail.
  return <VerifyEmail token={token ?? ""} />;
}
