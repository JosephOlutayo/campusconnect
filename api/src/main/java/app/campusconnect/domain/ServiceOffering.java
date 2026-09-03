package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

/**
 * One bookable thing a provider sells — "Signature Haircut, $25, 30 minutes".
 *
 * Named ServiceOffering rather than Service so it never collides with Spring's
 * {@code @Service} stereotype in imports or in conversation.
 *
 * Money is an integer number of cents. Never a float, anywhere in this codebase.
 */
@Entity
@Table(name = "service_offerings", indexes = {
        @Index(name = "idx_service_provider", columnList = "provider_id"),
        @Index(name = "idx_service_category", columnList = "category_id"),
        @Index(name = "idx_service_active", columnList = "active")
})
@Getter
@Setter
@NoArgsConstructor
public class ServiceOffering {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 140)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false)
    private int priceCents;

    @Column(nullable = false)
    private int durationMinutes;

    /** Empty means "inherit whatever the provider offers". */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_location_modes", joinColumns = @JoinColumn(name = "service_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "mode", length = 20, nullable = false)
    private Set<LocationMode> locationModes = EnumSet.noneOf(LocationMode.class);

    @Column(nullable = false)
    private boolean active = true;

    /** Drives the "what they are known for" headline on search cards. */
    @Column(nullable = false)
    private int bookingCount = 0;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ServiceOffering(ProviderProfile provider, Category category, String title,
                           String description, int priceCents, int durationMinutes,
                           Set<LocationMode> locationModes) {
        this.provider = provider;
        this.category = category;
        this.title = title;
        this.description = description;
        this.priceCents = priceCents;
        this.durationMinutes = durationMinutes;
        this.locationModes = locationModes;
    }

    /** The service's own modes when set, otherwise the provider's. */
    public Set<LocationMode> effectiveLocationModes() {
        return locationModes.isEmpty() ? provider.getLocationModes() : locationModes;
    }
}
