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
                EmailVerificationToken.Purpose.CONFIRM_CURRENT, Instant.now().plus(LIFETIME)));

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
     * Starts an email change. Nothing moves until the link is followed.
     *
     * The link goes to the NEW address, because the point is to prove that
     * inbox is reachable. The current address gets a heads-up instead — that
     * warning is how somebody finds out their account is being taken over,
     * while they can still do something about it.
     */
    @Transactional
    public void requestEmailChange(User user, String newEmail, String currentPassword) {
        // A hijacked session should not be enough to walk off with the account.
        if (!authService.passwordMatches(user, currentPassword)) {
            throw ApiException.badRequest("That password is not right.");
        }

        String claimed = newEmail == null ? "" : newEmail.trim().toLowerCase();
        if (claimed.isBlank() || !claimed.contains("@")) {
            throw ApiException.badRequest("Enter a valid email address.");
        }
        if (claimed.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("That is already your email address.");
        }
        if (users.existsByEmailIgnoreCase(claimed)) {
            // The address is in use. Said plainly because the person asking has
            // already proven who they are with their password.
            throw ApiException.badRequest("Another account already uses that address.");
        }
        if (tokens.countByUserAndCreatedAtAfter(user, Instant.now().minus(Duration.ofHours(1))) >= MAX_PER_HOUR) {
            throw ApiException.badRequest(
                    "That is a lot of requests. Please wait an hour before trying again.");
        }

        tokens.deleteByUser(user);

        byte[] raw = new byte[TOKEN_BYTES];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        tokens.save(new EmailVerificationToken(user, hash(token), claimed,
                EmailVerificationToken.Purpose.CHANGE_TO, Instant.now().plus(LIFETIME)));

        String link = appUrl + "/verify-email?token=" + token;
        mailer.send(claimed, "Confirm your new CampusConnect email", """
                Hi %s,

                Confirm this address to move your CampusConnect account to it:

                %s

                This link works once and expires in 24 hours. Your account keeps
                its current address until you follow it.
                """.formatted(user.getName(), link));

        mailer.send(user.getEmail(), "Your CampusConnect email is being changed", """
                Hi %s,

                Somebody asked to move this account to %s. It will only move once
                that address is confirmed, and this one will stop working for
                signing in.

                If this was not you, change your password now — someone else has
                access to your account.
                """.formatted(user.getName(), claimed));

        log.info("Email change requested for {} -> {}", user.getEmail(), claimed);
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

        if (record.getPurpose() == EmailVerificationToken.Purpose.CHANGE_TO) {
            // Somebody else may have registered this address between the request
            // and the click.
            String claimed = record.getSentTo();
            boolean takenBySomeoneElse = users.findByEmailIgnoreCase(claimed)
                    .filter(other -> !other.getId().equals(user.getId()))
                    .isPresent();
            if (takenBySomeoneElse) {
                throw ApiException.badRequest(
                        "That address now belongs to another account.");
            }
            user.setEmail(claimed);
        } else if (!record.getSentTo().equalsIgnoreCase(user.getEmail())) {
            // The address changed after the link was sent. Verifying the new one
            // on the strength of a link sent to the old would let somebody
            // launder an unverified address through a verified account.
            throw ApiException.badRequest(
                    "This link was sent to a different address. Ask for a new one.");
        }

        record.setConsumedAt(Instant.now());
        user.setEmailVerifiedAt(Instant.now());

        // Now — and only now — does a campus domain earn the badge. Re-evaluated
        // from scratch, so changing to a non-campus address drops it.
        Optional<University> campus = authService.campusForEmail(user.getEmail());
        boolean matchesTheirCampus = campus.isPresent()
                && user.getUniversity() != null
                && campus.get().getId().equals(user.getUniversity().getId());
        user.setStudentVerifiedAt(matchesTheirCampus ? Instant.now() : null);

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
