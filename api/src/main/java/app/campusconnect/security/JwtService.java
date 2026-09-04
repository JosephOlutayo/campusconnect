package app.campusconnect.security;

import app.campusconnect.domain.Role;
import app.campusconnect.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.UUID;

/** Signs and verifies the session JWT. HS256 with a shared secret. */
@Service
public class JwtService {

    /**
     * The value shipped in application.yml. Anyone reading this repository knows
     * it, so a deployment still using it can have its admin tokens forged by a
     * stranger. Startup refuses rather than letting that reach the internet.
     */
    static final String DEV_SECRET = "dev-only-change-me-0123456789abcdefghijklmnop";

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${campusconnect.jwt.secret}") String secret,
                      @Value("${campusconnect.jwt.ttl-days:30}") long ttlDays,
                      Environment environment) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "campusconnect.jwt.secret must be at least 32 characters. Set CAMPUSCONNECT_JWT_SECRET.");
        }

        boolean isProduction = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (isProduction && DEV_SECRET.equals(secret)) {
            throw new IllegalStateException("""

                    REFUSING TO START: the production profile is active but the JWT secret is
                    still the development default, which is published in this repository.
                    Anyone could forge an admin session.

                    Set CAMPUSCONNECT_JWT_SECRET to a real value, for example:
                      openssl rand -base64 48
                    """);
        }

        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofDays(ttlDays);
    }

    public String issue(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Returns null for anything expired, tampered with or malformed. */
    public AuthenticatedUser parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return new AuthenticatedUser(
                    UUID.fromString(claims.getSubject()),
                    claims.get("email", String.class),
                    Role.valueOf(claims.get("role", String.class)));
        } catch (JwtException | IllegalArgumentException ex) {
            return null;
        }
    }

    public long ttlSeconds() {
        return ttl.toSeconds();
    }
}
