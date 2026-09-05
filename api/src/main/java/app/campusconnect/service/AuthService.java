package app.campusconnect.service;

import app.campusconnect.domain.Role;
import app.campusconnect.domain.University;
import app.campusconnect.domain.User;
import app.campusconnect.repository.UniversityRepository;
import app.campusconnect.repository.UserRepository;
import app.campusconnect.web.ApiException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository users;
    private final UniversityRepository universities;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository users, UniversityRepository universities,
                       PasswordEncoder passwordEncoder) {
        this.users = users;
        this.universities = universities;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Resolves a campus from the email domain.
     *
     * Domains live in the database precisely because universities do not agree
     * on a convention — utdallas.edu, mavs.uta.edu, my.unt.edu are all valid
     * student domains somewhere.
     */
    @Transactional(readOnly = true)
    public Optional<University> campusForEmail(String email) {
        int at = email.indexOf('@');
        if (at < 0 || at == email.length() - 1) {
            return Optional.empty();
        }
        return universities.findByEmailDomain(email.substring(at + 1).toLowerCase());
    }

    @Transactional
    public User signup(String name, String email, String rawPassword, UUID universityId) {
        String normalised = email.trim().toLowerCase();

        if (users.existsByEmailIgnoreCase(normalised)) {
            throw new ApiException("An account with that email already exists. Try signing in.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        University university = universities.findById(universityId)
                .orElseThrow(() -> ApiException.badRequest("Pick a university from the list."));

        User user = new User(
                normalised,
                passwordEncoder.encode(rawPassword),
                name.trim(),
                Role.STUDENT,
                name.trim().toLowerCase().replaceAll("\\s+", "-") + "-"
                        + UUID.randomUUID().toString().substring(0, 6),
                university);

        // No badge here. A matching domain proves only that somebody typed an
        // address ending in it — anyone can do that, and the domain is public.
        // Both flags are set in EmailVerificationService.consume, once the
        // person has followed a link sent to that address.
        return users.save(user);
    }

    @Transactional(readOnly = true)
    public User login(String email, String rawPassword) {
        // Same message for both failure modes — never confirm which half was wrong.
        User user = users.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> ApiException.unauthorized("That email and password do not match."));

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw ApiException.unauthorized("That email and password do not match.");
        }
        if (user.isSuspended()) {
            throw ApiException.forbidden("This account is suspended. Contact support@campusconnect.app");
        }
        return user;
    }

    @Transactional(readOnly = true)
    public User require(UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Sign in first."));
        if (user.isSuspended()) {
            throw ApiException.forbidden("This account is suspended.");
        }
        return user;
    }
}
