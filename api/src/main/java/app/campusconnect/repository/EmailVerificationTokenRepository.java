package app.campusconnect.repository;

import app.campusconnect.domain.EmailVerificationToken;
import app.campusconnect.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, UUID> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    /** Used to throttle resends: how many links has this user asked for lately. */
    long countByUserAndCreatedAtAfter(User user, Instant since);

    /** Outstanding links are invalidated whenever a new one is issued. */
    void deleteByUser(User user);
}
