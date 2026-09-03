package app.campusconnect.web;

import app.campusconnect.domain.User;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.security.JwtAuthFilter;
import app.campusconnect.security.JwtService;
import app.campusconnect.service.AuthService;
import app.campusconnect.web.dto.AuthDtos.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
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
    private final JwtService jwtService;

    public AuthController(AuthService authService, JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    /**
     * Issues the token twice on purpose: in the body for API clients that hold
     * it themselves, and as an httpOnly cookie so browser JavaScript can never
     * read it (which is what makes XSS unable to steal a session).
     */
    private void attachCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, token)
                .httpOnly(true)
                .secure(false) // true behind HTTPS in production
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
                .httpOnly(true).path("/").maxAge(0).build();
        response.addHeader("Set-Cookie", cleared.toString());
        return ApiResponse.ok("signed out");
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
