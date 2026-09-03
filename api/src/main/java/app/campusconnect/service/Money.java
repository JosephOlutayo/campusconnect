package app.campusconnect.service;

import app.campusconnect.domain.DiscountType;
import app.campusconnect.domain.Promotion;

/**
 * All money maths. Integer cents only — a marketplace ledger is the last place
 * you want floating point rounding.
 */
public final class Money {

    private Money() {
    }

    /** What the customer pays, what the platform keeps, what the provider gets. */
    public record FeeSplit(int totalCents, int platformFeeCents, int providerPayoutCents) {
    }

    /**
     * $40 at a 10% fee: provider $36, platform $4.
     * The fee floors, so rounding never quietly costs the provider a cent.
     */
    public static FeeSplit split(int totalCents, double feePercent) {
        int safeTotal = Math.max(0, totalCents);
        double safePercent = Math.min(100, Math.max(0, feePercent));
        int fee = (int) Math.floor(safeTotal * safePercent / 100.0);
        return new FeeSplit(safeTotal, fee, safeTotal - fee);
    }

    public static int applyDiscount(int priceCents, Promotion promotion) {
        if (promotion == null) {
            return priceCents;
        }
        if (promotion.getDiscountType() == DiscountType.PERCENT) {
            int off = (int) Math.floor(priceCents * promotion.getDiscountValue() / 100.0);
            return Math.max(0, priceCents - off);
        }
        return Math.max(0, priceCents - promotion.getDiscountValue());
    }

    public static String format(int cents) {
        return String.format("$%,.2f", cents / 100.0);
    }
}
