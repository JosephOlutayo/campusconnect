package app.campusconnect.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
     * The address the link was sent to.
     *
     * For CONFIRM_CURRENT this is the account's address as it stood when the
     * link was issued, so a stale link cannot verify an address changed since.
     * For CHANGE_TO it is the new address being claimed, and the account moves
     * to it on redemption — which is why the link goes there and not to the
     * current inbox. Proving you can read the destination is the whole point.
     */
    @Column(nullable = false, length = 190)
    private String sentTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Purpose purpose = Purpose.CONFIRM_CURRENT;

    @Column(nullable = false)
    private Instant expiresAt;

    /** Set the moment it is used, so a link works exactly once. */
    private Instant consumedAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public EmailVerificationToken(User user, String tokenHash, String sentTo,
                                 Purpose purpose, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.sentTo = sentTo;
        this.purpose = purpose;
        this.expiresAt = expiresAt;
    }

    public enum Purpose {
        /** Prove the address already on the account. */
        CONFIRM_CURRENT,
        /** Prove a new address, then move the account to it. */
        CHANGE_TO
    }

    public boolean isUsable(Instant now) {
        return consumedAt == null && now.isBefore(expiresAt);
    }
}
