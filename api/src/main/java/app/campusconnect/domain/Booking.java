package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A booked appointment.
 *
 * PRICE SNAPSHOT: priceCents, platformFeeCents and providerPayoutCents are copied
 * in at booking time and never recalculated. A provider raising their price, or an
 * admin changing the marketplace fee, must not silently rewrite what someone
 * already agreed to pay.
 *
 * BLOCK END: {@link #blockEndAt} is endAt plus the provider's buffer. Every
 * overlap check compares against this rather than endAt, so turnaround time is
 * baked into the data instead of being re-derived at each call site.
 */
@Entity
@Table(name = "bookings", indexes = {
        @Index(name = "idx_booking_customer", columnList = "customer_id"),
        @Index(name = "idx_booking_provider", columnList = "provider_id"),
        @Index(name = "idx_booking_start", columnList = "startAt"),
        @Index(name = "idx_booking_provider_window", columnList = "provider_id,startAt"),
        @Index(name = "idx_booking_provider_status", columnList = "provider_id,status")
})
@Getter
@Setter
@NoArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Human-friendly reference, e.g. CC-7F3K2A. Short enough to read out loud. */
    @Column(nullable = false, unique = true, length = 12)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false)
    private ServiceOffering service;

    @Column(nullable = false)
    private LocalDateTime startAt;

    @Column(nullable = false)
    private LocalDateTime endAt;

    /** endAt + provider buffer. This is what overlap checks use. */
    @Column(nullable = false)
    private LocalDateTime blockEndAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status = BookingStatus.PENDING;

    @Column(nullable = false)
    private int priceCents;

    @Column(nullable = false)
    private int platformFeeCents;

    @Column(nullable = false)
    private int providerPayoutCents;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LocationMode locationMode;

    @Column(nullable = false, length = 200)
    private String locationLabel;

    @Column(length = 600)
    private String customerNote;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant confirmedAt;
    private Instant completedAt;
    private Instant cancelledAt;

    @Column(length = 400)
    private String cancellationReason;

    /** Who pressed cancel — used to word the notification correctly. */
    @Column(name = "cancelled_by_user_id")
    private UUID cancelledByUserId;

    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private Payment payment;

    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private Review review;

    public Booking(String code, User customer, ProviderProfile provider, ServiceOffering service,
                   LocalDateTime startAt, LocalDateTime endAt, LocalDateTime blockEndAt,
                   BookingStatus status, int priceCents, int platformFeeCents, int providerPayoutCents,
                   LocationMode locationMode, String locationLabel, String customerNote) {
        this.code = code;
        this.customer = customer;
        this.provider = provider;
        this.service = service;
        this.startAt = startAt;
        this.endAt = endAt;
        this.blockEndAt = blockEndAt;
        this.status = status;
        this.priceCents = priceCents;
        this.platformFeeCents = platformFeeCents;
        this.providerPayoutCents = providerPayoutCents;
        this.locationMode = locationMode;
        this.locationLabel = locationLabel;
        this.customerNote = customerNote;
    }

    public boolean isUpcoming() {
        return status == BookingStatus.PENDING || status == BookingStatus.CONFIRMED;
    }

    /**
     * The exact address is a privacy boundary: it is released only to the customer
     * who booked, and only once the provider has actually confirmed.
     */
    public boolean addressUnlocked() {
        return locationMode == LocationMode.AT_PROVIDER
                && (status == BookingStatus.CONFIRMED || status == BookingStatus.COMPLETED);
    }
}
