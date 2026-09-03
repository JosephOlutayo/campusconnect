package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/** A provider-run discount code. */
@Entity
@Table(
        name = "promotions",
        uniqueConstraints = @UniqueConstraint(name = "uq_promotion_code",
                columnNames = {"provider_id", "code"}),
        indexes = @Index(name = "idx_promotion_provider", columnList = "provider_id"))
@Getter
@Setter
@NoArgsConstructor
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 200)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private DiscountType discountType;

    /** Percentage points for PERCENT, cents for AMOUNT. */
    @Column(nullable = false)
    private int discountValue;

    @Column(nullable = false)
    private LocalDateTime startsAt;

    @Column(nullable = false)
    private LocalDateTime endsAt;

    private Integer maxRedemptions;

    @Column(nullable = false)
    private int redemptions = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Promotion(ProviderProfile provider, String code, String description,
                     DiscountType discountType, int discountValue,
                     LocalDateTime startsAt, LocalDateTime endsAt, Integer maxRedemptions) {
        this.provider = provider;
        this.code = code;
        this.description = description;
        this.discountType = discountType;
        this.discountValue = discountValue;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.maxRedemptions = maxRedemptions;
    }

    public boolean redeemableAt(LocalDateTime when) {
        return active
                && !when.isBefore(startsAt)
                && !when.isAfter(endsAt)
                && (maxRedemptions == null || redemptions < maxRedemptions);
    }
}
