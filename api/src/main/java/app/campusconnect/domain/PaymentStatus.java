package app.campusconnect.domain;

/** Mirrors the Stripe PaymentIntent lifecycle so swapping the gateway is mechanical. */
public enum PaymentStatus {
    /** Authorised at booking time, money not yet taken. */
    REQUIRES_CAPTURE,
    /** Captured when the appointment is marked complete. */
    SUCCEEDED,
    REFUNDED,
    FAILED
}
