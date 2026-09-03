package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One payment per booking, shaped to match a Stripe PaymentIntent field for
 * field, so switching from the mock gateway to real Stripe needs no schema change.
 *
 * The money model is Stripe Connect destination charges:
 *   customer card -> platform account -> transfer to provider,
 *   platform keeping application_fee_amount.
 */
@Entity
@Table(name = "payments", indexes = @Index(name = "idx_payment_status", columnList = "status"))
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    private Booking booking;

    @Column(nullable = false)
    private int amountCents;

    /** Stripe's application_fee_amount. */
    @Column(nullable = false)
    private int platformFeeCents;

    /** What lands in the provider's balance. */
    @Column(nullable = false)
    private int providerAmountCents;

    @Column(nullable = false, length = 8)
    private String currency = "usd";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private PaymentStatus status = PaymentStatus.REQUIRES_CAPTURE;

    /** MOCK until STRIPE_SECRET_KEY is present. */
    @Column(nullable = false, length = 16)
    private String gateway = "MOCK";

    /** The PaymentIntent id once real Stripe is wired up. */
    @Column(length = 120)
    private String externalId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant capturedAt;
    private Instant refundedAt;

    public Payment(Booking booking, int amountCents, int platformFeeCents,
                   int providerAmountCents, String gateway, String externalId) {
        this.booking = booking;
        this.amountCents = amountCents;
        this.platformFeeCents = platformFeeCents;
        this.providerAmountCents = providerAmountCents;
        this.gateway = gateway;
        this.externalId = externalId;
    }
}
