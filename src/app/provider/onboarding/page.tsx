import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/queries";
import { getPlatformFeePercent } from "@/lib/settings";
import { PageHeader } from "@/components/shell/PageHeader";
import { OnboardingForm } from "@/components/provider/OnboardingForm";

export const metadata: Metadata = { title: "Become a provider" };

export default async function OnboardingPage() {
  const user = await requireUser();
  // Already set up — no reason to be here.
  if (user.providerProfile) redirect("/provider");
  if (!user.universityId) redirect("/profile");

  const [categories, feePercent] = await Promise.all([getCategories(), getPlatformFeePercent()]);

  return (
    <>
      <PageHeader
        eyebrow="Set up in about two minutes"
        title="Start offering services"
        subtitle="Your prices, your hours, your rules. Students on your campus find you the moment you finish."
      />
      <OnboardingForm
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        }))}
        universityName={user.university?.shortName ?? "campus"}
        feePercent={feePercent}
      />
    </>
  );
}
