package app.campusconnect.security;

import java.lang.annotation.*;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Injects the {@link AuthenticatedUser} into a controller method.
 *
 * Wraps @AuthenticationPrincipal purely so controller signatures read as
 * {@code @CurrentUser AuthenticatedUser me} rather than repeating the longer
 * Spring Security annotation everywhere.
 */
@Target({ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal
public @interface CurrentUser {
}
