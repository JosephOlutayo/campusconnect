package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * A provider's business. Holds the booking policy that the availability engine
 * reads on every slot calculation.
 */
@Entity
@Table(name = "provider_profiles", indexes = {
        @Index(name = "idx_provider_university", columnList = "university_id"),
        @Index(name = "idx_provider_status", columnList = "status"),
        @Index(name = "idx_provider_rating", columnList = "ratingAvg")
})
@Getter
@Setter
@NoArgsConstructor
public class ProviderProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, length = 120)
    private String businessName;

    @Column(length = 160)
    private String tagline;

    @Column(nullable = false, length = 4000)
    private String bio;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "university_id", nullable = false)
    private University university;

    /** PUBLIC location only — never the doorstep. See {@link #exactAddress}. */
    @Column(nullable = false, length = 160)
    private String locationLabel;

    /** Released to the customer only once a booking is CONFIRMED. */
    @Column(length = 250)
    private String exactAddress;

    /** Deliberately blurred coordinates; the exact position is never sent to a browser. */
    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "provider_location_modes", joinColumns = @JoinColumn(name = "provider_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "mode", length = 20, nullable = false)
    private Set<LocationMode> locationModes = EnumSet.of(LocationMode.AT_PROVIDER);

    // --- booking policy, all read by the availability engine -----------------

    /** false means every request waits for the provider to accept. */
    @Column(nullable = false)
    private boolean autoConfirmBookings = true;

    /** Turnaround time after each appointment, in minutes. */
    @Column(nullable = false)
    private int bufferMinutes = 0;

    /** How far ahead a booking must be made. */
    @Column(nullable = false)
    private int minNoticeMinutes = 120;

    /** How far into the future the calendar is open. */
    @Column(nullable = false)
    private int maxAdvanceDays = 60;

    @Column(nullable = false, length = 600)
    private String cancellationPolicy = "Free cancellation up to 12 hours before your appointment.";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProviderStatus status = ProviderStatus.ACTIVE;

    /** The blue tick. Only ever set by an admin. */
    @Column(nullable = false)
    private boolean verified = false;

    // --- denormalised for fast sorting; recomputed on every review write -----

    @Column(nullable = false)
    private double ratingAvg = 0;

    @Column(nullable = false)
    private int ratingCount = 0;

    @Column(nullable = false)
    private int completedBookings = 0;

    /** Null until the provider finishes Stripe Connect onboarding. */
    @Column(length = 120)
    private String stripeAccountId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ServiceOffering> services = new ArrayList<>();

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AvailabilityRule> availabilityRules = new ArrayList<>();

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PortfolioImage> portfolio = new ArrayList<>();

    public ProviderProfile(User user, String businessName, String bio, University university,
                           String locationLabel, double latitude, double longitude) {
        this.user = user;
        this.businessName = businessName;
        this.bio = bio;
        this.university = university;
        this.locationLabel = locationLabel;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public boolean isBookable() {
        return status == ProviderStatus.ACTIVE && !user.isSuspended();
    }
}
