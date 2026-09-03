package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A portfolio shot.
 *
 * {@code seed} drives a deterministic gradient rendered on the client, so the
 * app needs no external image host to look complete. When real uploads exist,
 * fill {@code url} and the frontend prefers it automatically.
 */
@Entity
@Table(name = "portfolio_images", indexes = {
        @Index(name = "idx_portfolio_provider", columnList = "provider_id"),
        @Index(name = "idx_portfolio_service", columnList = "service_id")
})
@Getter
@Setter
@NoArgsConstructor
public class PortfolioImage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceOffering service;

    @Column(nullable = false, length = 120)
    private String seed;

    /** Cloudinary/S3 URL once real uploads are wired up. */
    @Column(length = 500)
    private String url;

    @Column(length = 200)
    private String caption;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public PortfolioImage(ProviderProfile provider, String seed, String caption, int sortOrder) {
        this.provider = provider;
        this.seed = seed;
        this.caption = caption;
        this.sortOrder = sortOrder;
    }
}
