import type { Metadata } from "next";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { PageHeader } from "@/components/shell/PageHeader";
import { PromotionManager } from "@/components/provider/PromotionManager";

export const metadata: Metadata = { title: "Promotions" };
export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const { providerId } = await requireProvider();

  const promotions = await prisma.promotion.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Promotions"
        subtitle="Discount codes students apply when they book. The discount comes out of your side, not the platform fee."
      />
      <PromotionManager
        promotions={promotions.map((promotion) => ({
          id: promotion.id,
          code: promotion.code,
          description: promotion.description,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          startsAt: promotion.startsAt.toISOString(),
          endsAt: promotion.endsAt.toISOString(),
          isActive: promotion.isActive,
          redemptions: promotion.redemptions,
          maxRedemptions: promotion.maxRedemptions,
        }))}
      />
    </>
  );
}
