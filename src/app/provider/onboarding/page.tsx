import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import type { Category } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { OnboardingForm } from "@/components/provider/OnboardingForm";

export const metadata: Metadata = { title: "Become a provider" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();

  // Already a provider? There is nothing to set up.
  if (user.providerProfileId) redirect("/provider");

  const [categories, settings] = await Promise.all([
    apiGet<Category[]>("/api/categories"),
    apiGet<{ platformFeePercent: number }>("/api/stats/settings"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Set up"
        title="Start offering services"
        subtitle="Two minutes now, and students on your campus can book you today."
      />
      <OnboardingForm
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        }))}
        universityName={user.universityName ?? "your campus"}
        feePercent={settings.platformFeePercent}
      />
    </>
  );
}
