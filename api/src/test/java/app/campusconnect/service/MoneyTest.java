package app.campusconnect.service;

import app.campusconnect.domain.DiscountType;
import app.campusconnect.domain.Promotion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The fee split is where rounding mistakes turn into missing money. */
class MoneyTest {

    @Test
    @DisplayName("the worked example from the brief: $40 at 10%")
    void splitsTheHeadlineExample() {
        Money.FeeSplit split = Money.split(4000, 10);

        assertThat(split.totalCents()).isEqualTo(4000);
        assertThat(split.platformFeeCents()).isEqualTo(400);
        assertThat(split.providerPayoutCents()).isEqualTo(3600);
    }

    @Test
    @DisplayName("the two halves always reconstruct the total, whatever the rounding")
    void splitAlwaysReconciles() {
        for (int amount = 1; amount <= 20000; amount += 7) {
            for (double percent : new double[]{0, 2.5, 10, 12, 17.5, 33.3, 50}) {
                Money.FeeSplit split = Money.split(amount, percent);
                assertThat(split.platformFeeCents() + split.providerPayoutCents())
                        .as("amount=%d percent=%s", amount, percent)
                        .isEqualTo(amount);
            }
        }
    }

    @Test
    @DisplayName("the fee floors, so rounding never costs the provider a cent")
    void feeRoundsInTheProvidersFavour() {
        // 10% of 999 is 99.9 -> platform takes 99, provider keeps 900.
        Money.FeeSplit split = Money.split(999, 10);
        assertThat(split.platformFeeCents()).isEqualTo(99);
        assertThat(split.providerPayoutCents()).isEqualTo(900);
    }

    @Test
    @DisplayName("percentages are clamped rather than trusted")
    void clampsOutOfRangePercentages() {
        assertThat(Money.split(1000, -5).platformFeeCents()).isZero();
        assertThat(Money.split(1000, 500).providerPayoutCents()).isZero();
    }

    @Test
    @DisplayName("a zero-fee marketplace pays the provider everything")
    void zeroFeeGivesProviderEverything() {
        assertThat(Money.split(2500, 0).providerPayoutCents()).isEqualTo(2500);
    }

    @Test
    @DisplayName("percent discounts come off the price before the fee is taken")
    void appliesPercentDiscount() {
        Promotion promo = new Promotion(null, "FIRST10", "10% off",
                DiscountType.PERCENT, 10, null, null, null);
        assertThat(Money.applyDiscount(5000, promo)).isEqualTo(4500);
    }

    @Test
    @DisplayName("amount discounts subtract cents")
    void appliesAmountDiscount() {
        Promotion promo = new Promotion(null, "SYLLABUS", "$5 off",
                DiscountType.AMOUNT, 500, null, null, null);
        assertThat(Money.applyDiscount(2500, promo)).isEqualTo(2000);
    }

    @Test
    @DisplayName("a discount can never push a price below zero")
    void discountNeverGoesNegative() {
        Promotion huge = new Promotion(null, "TOOMUCH", "$100 off",
                DiscountType.AMOUNT, 10000, null, null, null);
        assertThat(Money.applyDiscount(2500, huge)).isZero();
    }

    @Test
    @DisplayName("no promotion leaves the price untouched")
    void noPromotionIsANoOp() {
        assertThat(Money.applyDiscount(2500, null)).isEqualTo(2500);
    }
}
