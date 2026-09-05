package app.campusconnect.service;

import app.campusconnect.domain.EmailVerificationToken;
import app.campusconnect.domain.University;
import app.campusconnect.domain.User;
import app.campusconnect.repository.EmailVerificationTokenRepository;
import app.campusconnect.repository.UserRepository;
import app.campusconnect.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Issues and redeems the "confirm your email" links.
 *
 * The point of all this is that a matching domain proves nothing on its own —
 * anyone can type someone else's campus address. The badge is only earned by
 * demonstrating you can read mail sent to it.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

    private static final Duration LIFETIME = Duration.ofHours(24);
    /** Enough entropy that guessing is hopeless. */
    private static final int TOKEN_BYTES = 32;
    /** Resend ceiling per user per hour, so this cannot be used to spam an inbox. */
    private static final int MAX_PER_HOUR = 5;

    private final EmailVerificationTokenRepository tokens;
    private final UserRepository users;
    private final AuthService authService;
    private final Mailer mailer;
    private final String appUrl;
    private final SecureRandom random = new SecureRandom();

    public EmailVerificationService(EmailVerificationTokenRepository tokens,
                                    UserRepository users,
                                    AuthService authService,
                                    Mailer mailer,
                                    @Value("${campusconnect.app-url:http://localhost:3000}") String appUrl) {
        this.tokens = tokens;
        this.users = users;
        this.authService = authService;
        this.mailer = mailer;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    /**
     * Sends a fresh link, invalidating any earlier one.
     *
     * Never throws because an address looks undeliverable — that would turn
     * signup into a way to discover which emails exist.
     */
    @Transactional
    public void issue(User user) {
        if (user.getEmailVerifiedAt() != null) {
            return; // already proven; nothing to send
        }
        if (tokens.countByUserAndCreatedAtAfter(user, Instant.now().minus(Duration.ofHours(1))) >= MAX_PER_HOUR) {
            throw ApiException.badRequest(
                    "That is a lot of verification emails. Please wait an hour before asking for another.");
        }

        // Only the newest link should work.
        tokens.deleteByUser(user);

        byte[] raw = new byte[TOKEN_BYTES];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        tokens.save(new EmailVerificationToken(user, hash(token), user.getEmail(),
                Instant.now().plus(LIFETIME)));

        String link = appUrl + "/verify-email?token=" + token;
        mailer.send(user.getEmail(), "Confirm your CampusConnect email", """
                Hi %s,

                Confirm this address to finish setting up your CampusConnect account:

                %s

                This link works once and expires in 24 hours.

                If you did not create an account, you can ignore this email.
                """.formatted(user.getName(), link));
    }

    /**
     * Redeems a link. Returns the user it belonged to.
     *
     * The campus badge is granted here and only here — the address has to be
     * proven before the domain is allowed to mean anything.
     */
    @Transactional
    public User consume(String token) {
        if (token == null || token.isBlank()) {
            throw ApiException.badRequest("That verification link is not valid.");
        }

        EmailVerificationToken record = tokens.findByTokenHash(hash(token))
                .orElseThrow(() -> ApiException.badRequest(
                        "That verification link is not valid. Ask for a new one."));

        if (!record.isUsable(Instant.now())) {
            throw ApiException.badRequest(
                    "That verification link has expired or was already used. Ask for a new one.");
        }

        User user = record.getUser();

        // The address may have been changed after the link was sent. Verifying
        // the new one on the strength of a link sent to the old one would let
        // somebody launder an unverified address through a verified account.
        if (!record.getSentTo().equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest(
                    "This link was sent to a different address. Ask for a new one.");
        }

        record.setConsumedAt(Instant.now());
        user.setEmailVerifiedAt(Instant.now());

        // Now — and only now — does a campus domain earn the badge.
        Optional<University> campus = authService.campusForEmail(user.getEmail());
        boolean matchesTheirCampus = campus.isPresent()
                && user.getUniversity() != null
                && campus.get().getId().equals(user.getUniversity().getId());
        if (matchesTheirCampus) {
            user.setStudentVerifiedAt(Instant.now());
        }

        users.save(user);
        log.info("Email verified for {} (campus badge: {})", user.getEmail(), matchesTheirCampus);
        return user;
    }

    private static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required and always present", e);
        }
    }
}
