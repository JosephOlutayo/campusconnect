package app.campusconnect.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A one-time link proving somebody can read mail at the address they claimed.
 *
 * Only the SHA-256 hash of the token is stored. The token itself exists in the
 * email and nowhere else, so a leaked database backup cannot be used to verify
 * anyone's account — the same reasoning as storing password hashes.
 */
@Entity
@Table(name = "email_verification_tokens",
        indexes = @Index(name = "idx_evt_token_hash", columnList = "tokenHash"))
@Getter
@Setter
@NoArgsConstructor
public class EmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Hex SHA-256 of the token that was emailed. Never the token itself. */
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    /**
     * The address the link was sent to, captured at issue time. Someone can
     * change their email after requesting a link; that older link must not
     * then verify the new address.
     */
    @Column(nullable = false, length = 190)
    private String sentTo;

    @Column(nullable = false)
    private Instant expiresAt;

    /** Set the moment it is used, so a link works exactly once. */
    private Instant consumedAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public EmailVerificationToken(User user, String tokenHash, String sentTo, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.sentTo = sentTo;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(Instant now) {
        return consumedAt == null && now.isBefore(expiresAt);
    }
}
