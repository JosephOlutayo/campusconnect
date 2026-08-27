// Money is integer cents everywhere. Never floats — 0.1 + 0.2 problems in a
// marketplace ledger are not worth the convenience.

export const DEFAULT_PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCentsExact(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function dollarsToCents(dollars: number | string): number {
  const value = typeof dollars === "string" ? Number.parseFloat(dollars) : dollars;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export type FeeSplit = {
  /** What the customer is charged. */
  totalCents: number;
  /** What the platform keeps. */
  platformFeeCents: number;
  /** What lands in the provider's Stripe balance. */
  providerPayoutCents: number;
};

/**
 * $40 service at a 10% marketplace fee => provider $36, platform $4.
 * The fee is floored so rounding never charges the provider an extra cent.
 */
export function splitFee(totalCents: number, feePercent: number): FeeSplit {
  const safeTotal = Math.max(0, Math.round(totalCents));
  const safePercent = Math.min(100, Math.max(0, feePercent));
  const platformFeeCents = Math.floor((safeTotal * safePercent) / 100);
  return {
    totalCents: safeTotal,
    platformFeeCents,
    providerPayoutCents: safeTotal - platformFeeCents,
  };
}

export type DiscountInput = {
  discountType: string;
  discountValue: number;
};

export function applyDiscount(priceCents: number, promo: DiscountInput | null): number {
  if (!promo) return priceCents;
  if (promo.discountType === "PERCENT") {
    return Math.max(0, priceCents - Math.floor((priceCents * promo.discountValue) / 100));
  }
  return Math.max(0, priceCents - promo.discountValue);
}
