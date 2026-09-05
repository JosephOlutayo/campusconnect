package app.campusconnect.web;

import app.campusconnect.domain.User;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.security.JwtAuthFilter;
import app.campusconnect.security.JwtService;
import app.campusconnect.service.AuthService;
import app.campusconnect.service.EmailVerificationService;
import app.campusconnect.web.dto.AuthDtos.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerification;
    private final JwtService jwtService;
    private final boolean secureCookies;

    public AuthController(AuthService authService, JwtService jwtService,
                          EmailVerificationService emailVerification,
                          @Value("${campusconnect.secure-cookies:false}") boolean secureCookies) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.emailVerification = emailVerification;
        this.secureCookies = secureCookies;
    }

    /**
     * Issues the token twice on purpose: in the body for API clients that hold
     * it themselves, and as an httpOnly cookie so browser JavaScript can never
     * read it (which is what makes XSS unable to steal a session).
     */
    private void attachCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, token)
                .httpOnly(true)
                // Mandatory over HTTPS; the prod profile turns this on.
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(jwtService.ttlSeconds())
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    @PostMapping("/signup")
    @Transactional
    public ResponseEntity<ApiResponse<SessionResponse>> signup(@Valid @RequestBody SignupRequest request,
                                                               HttpServletResponse response) {
        User user = authService.signup(request.name(), request.email(),
                request.password(), request.universityId());
        emailVerification.issue(user);
        String token = jwtService.issue(user);
        attachCookie(response, token);

        String next = "PROVIDER".equalsIgnoreCase(request.intent()) ? "/provider/onboarding" : "/";
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                new SessionResponse(token, UserDto.of(user), next, user.isStudentVerified())));
    }

    @PostMapping("/login")
    public ApiResponse<SessionResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletResponse response) {
        User user = authService.login(request.email(), request.password());
        String token = jwtService.issue(user);
        attachCookie(response, token);

        String next = switch (user.getRole()) {
            case ADMIN -> "/admin";
            case PROVIDER -> user.getProviderProfile() != null ? "/provider" : "/";
            default -> "/";
        };
        return ApiResponse.ok(new SessionResponse(token, UserDto.of(user), next, user.isStudentVerified()));
    }

    @PostMapping("/logout")
    public ApiResponse<String> logout(HttpServletResponse response) {
        ResponseCookie cleared = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, "")
                .httpOnly(true).secure(secureCookies).sameSite("Lax").path("/").maxAge(0).build();
        response.addHeader("Set-Cookie", cleared.toString());
        return ApiResponse.ok("signed out");
    }

    /**
     * Redeems a link from a verification email. Public: the person clicking it
     * may well be in a browser that has never signed in.
     */
    @PostMapping("/verify-email")
    @Transactional
    public ApiResponse<UserDto> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ApiResponse.ok(UserDto.of(emailVerification.consume(request.token())));
    }

    /** Sends another link to the signed-in user's own address. */
    @PostMapping("/resend-verification")
    @Transactional
    public ApiResponse<String> resendVerification(@CurrentUser AuthenticatedUser me) {
        if (me == null) {
            throw ApiException.unauthorized("Not signed in.");
        }
        User user = authService.require(me.id());
        if (user.getEmailVerifiedAt() != null) {
            return ApiResponse.ok("Your email is already confirmed.");
        }
        emailVerification.issue(user);
        return ApiResponse.ok("Check " + user.getEmail() + " for a new link.");
    }

    /** Who am I? Used by the client to hydrate the session on load. */
    @GetMapping("/me")
    public ApiResponse<UserDto> me(@CurrentUser AuthenticatedUser me) {
        if (me == null) {
            throw ApiException.unauthorized("Not signed in.");
        }
        return ApiResponse.ok(UserDto.of(authService.require(me.id())));
    }
}
