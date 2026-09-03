package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** A saved provider. The unique constraint makes a double-tap idempotent. */
@Entity
@Table(
        name = "favorites",
        uniqueConstraints = @UniqueConstraint(name = "uq_favorite",
                columnNames = {"user_id", "provider_id"}),
        indexes = @Index(name = "idx_favorite_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Favorite(User user, ProviderProfile provider) {
        this.user = user;
        this.provider = provider;
    }
}
