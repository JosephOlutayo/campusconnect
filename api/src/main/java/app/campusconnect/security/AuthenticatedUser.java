package app.campusconnect.security;

import app.campusconnect.domain.Role;

import java.util.UUID;

/**
 * The authenticated principal, carried in the SecurityContext.
 *
 * Only the claims from the token — no entity, no lazy-loaded graph. Controllers
 * that need the full user load it explicitly, which keeps it obvious when a
 * database read is happening.
 */
public record AuthenticatedUser(UUID id, String email, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
