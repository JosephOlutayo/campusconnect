package app.campusconnect.service;

import app.campusconnect.domain.Booking;
import app.campusconnect.domain.Payment;
import app.campusconnect.domain.PaymentStatus;
import app.campusconnect.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * PAYMENTS ARCHITECTURE
 *
 * The money model is Stripe Connect "destination charges":
 *
 *   customer card  ->  platform Stripe account  ->  transfer to provider
 *                          (platform keeps application_fee_amount)
 *
 * Every field recorded here — amount, application fee, transfer amount, external
 * id, capture and refund timestamps — maps one-to-one onto a Stripe
 * PaymentIntent, so switching gateways means implementing these three methods
 * against the Stripe SDK. No schema change, no caller change.
 *
 * Until a secret key exists the MOCK gateway runs the identical state machine in
 * the database. Nothing here fabricates a production credential.
 */
@Service
public class PaymentService {

    private final PaymentRepository payments;
    private final String stripeSecretKey;

    public PaymentService(PaymentRepository payments,
                          @Value("${STRIPE_SECRET_KEY:}") String stripeSecretKey) {
        this.payments = payments;
        this.stripeSecretKey = stripeSecretKey;
    }

    public String activeGateway() {
        return (stripeSecretKey != null && !stripeSecretKey.isBlank()) ? "STRIPE" : "MOCK";
    }

    /**
     * Authorise (do not capture) at booking time.
     * Real Stripe: paymentIntents.create with capture_method=manual,
     * application_fee_amount and transfer_data.destination.
     */
    @Transactional
    public Payment authorize(Booking booking, Money.FeeSplit split) {
        if ("STRIPE".equals(activeGateway())) {
            throw new IllegalStateException(
                    "Stripe gateway selected but the SDK is not wired up yet. See PaymentService.");
        }
        Payment payment = new Payment(
                booking,
                split.totalCents(),
                split.platformFeeCents(),
                split.providerPayoutCents(),
                "MOCK",
                "mock_pi_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        return payments.save(payment);
    }

    /** Capture when the appointment is marked complete. */
    @Transactional
    public void capture(UUID bookingId) {
        payments.findByBookingId(bookingId).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.REQUIRES_CAPTURE) {
                payment.setStatus(PaymentStatus.SUCCEEDED);
                payment.setCapturedAt(Instant.now());
                payments.save(payment);
            }
        });
    }

    /** Release the authorisation when a booking is cancelled or declined. */
    @Transactional
    public void refund(UUID bookingId) {
        payments.findByBookingId(bookingId).ifPresent(payment -> {
            if (payment.getStatus() != PaymentStatus.REFUNDED) {
                payment.setStatus(PaymentStatus.REFUNDED);
                payment.setRefundedAt(Instant.now());
                payments.save(payment);
            }
        });
    }
}
