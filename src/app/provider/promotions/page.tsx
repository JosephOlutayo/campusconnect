import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";

import { PageHeader } from "@/components/shell/PageHeader";
import { PromotionManager } from "@/components/provider/PromotionManager";

export const metadata: Metadata = { title: "Promotions" };
export const dynamic = "force-dynamic";

/** The API returns this listing as strings, so parsing happens here. */
type PromotionRow = {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: string;
  redemptions: string;
  maxRedemptions: string;
  startsAt: string;
  endsAt: string;
  active: string;
};

export default async function PromotionsPage() {
  await requireProvider();
  const rows = await apiGet<PromotionRow[]>("/api/provider/promotions");

  return (
    <>
      <PageHeader
        title="Promotions"
        subtitle="Discount codes students can apply at checkout. Good for a slow week or a first-time offer."
      />
      <PromotionManager
        promotions={rows.map((row) => ({
          id: row.id,
          code: row.code,
          description: row.description,
          discountType: row.discountType,
          discountValue: Number(row.discountValue),
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          isActive: row.active === "true",
          redemptions: Number(row.redemptions),
          maxRedemptions: row.maxRedemptions ? Number(row.maxRedemptions) : null,
        }))}
      />
    </>
  );
}
