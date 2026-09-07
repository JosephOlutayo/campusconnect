package app.campusconnect.view;

import app.campusconnect.domain.Role;
import app.campusconnect.domain.User;
import app.campusconnect.repository.UniversityRepository;
import app.campusconnect.security.JwtAuthFilter;
import app.campusconnect.security.JwtService;
import app.campusconnect.service.AuthService;
import app.campusconnect.service.EmailVerificationService;
import app.campusconnect.service.Mailer;
import app.campusconnect.web.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.UUID;

/**
 * Sign in, sign up and sign out as ordinary HTML forms.
 *
 * These post to the server and redirect, rather than calling the JSON API from
 * JavaScript. That means the pages work with scripting disabled, and the
 * browser handles the session cookie itself.
 *
 * The cookie is the same one the REST API issues, so a person signed in here is
 * signed in everywhere without a second mechanism to keep in step.
 */
@Controller
public class AuthViewController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final UniversityRepository universities;
    private final EmailVerificationService emailVerification;
    private final Mailer mailer;
    private final boolean secureCookies;

    public AuthViewController(AuthService authService,
                              JwtService jwtService,
                              UniversityRepository universities,
                              EmailVerificationService emailVerification,
                              Mailer mailer,
                              @Value("${campusconnect.secure-cookies:false}") boolean secureCookies) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.universities = universities;
        this.emailVerification = emailVerification;
        this.mailer = mailer;
        this.secureCookies = secureCookies;
    }

    // --- sign in -------------------------------------------------------------

    @GetMapping("/login")
    public String loginForm(@RequestParam(name = "next", required = false) String next, Model model) {
        model.addAttribute("active", "login");
        model.addAttribute("next", safeNext(next));
        return "login";
    }

    @PostMapping("/login")
    /*
     * Deliberately not @Transactional.
     *
     * AuthService already manages its own transactions. Opening one here too
     * means a failed sign-in marks it rollback-only, and although the exception
     * is caught and the form re-rendered, the commit at the end of the request
     * then throws UnexpectedRollbackException — turning a wrong password into a
     * 500 instead of "that email and password do not match".
     */
    public String login(@RequestParam String email,
                        @RequestParam String password,
                        @RequestParam(name = "next", required = false) String next,
                        HttpServletResponse response,
                        Model model) {
        try {
            User user = authService.login(email, password);
            attachSession(response, user);
            // Resume whatever they were trying to reach, rather than dumping
            // them on a landing page and making them navigate back.
            String target = safeNext(next);
            return "redirect:" + (target != null ? target : landingFor(user));
        } catch (ApiException failed) {
            // Back to the form with the address kept, so only the password has
            // to be typed again.
            model.addAttribute("active", "login");
            model.addAttribute("error", failed.getMessage());
            model.addAttribute("email", email);
            model.addAttribute("next", safeNext(next));
            return "login";
        }
    }

    /**
     * Only ever an in-app path.
     *
     * Accepting an arbitrary value here would make the sign-in page an open
     * redirect: a link to /login?next=https://evil.example could carry someone
     * off the site immediately after they authenticate, which is exactly when
     * they are least suspicious. A leading "//" is rejected too, since the
     * browser reads that as protocol-relative and treats it as another host.
     */
    private String safeNext(String next) {
        if (next == null || next.isBlank()) {
            return null;
        }
        if (!next.startsWith("/") || next.startsWith("//")) {
            return null;
        }
        return next;
    }

    // --- sign up -------------------------------------------------------------

    @GetMapping("/signup")
    @Transactional(readOnly = true)
    public String signupForm(Model model) {
        model.addAttribute("active", "signup");
        model.addAttribute("campuses", universities.findByActiveTrueOrderByNameAsc());
        // Telling someone to use a campus address so they can confirm it is a
        // promise this deployment cannot keep without a mail server.
        model.addAttribute("emailVerificationEnabled", mailer.deliversToInbox());
        return "signup";
    }

    @PostMapping("/signup")
    public String signup(@RequestParam String name,
                         @RequestParam String email,
                         @RequestParam String password,
                         @RequestParam(required = false) UUID universityId,
                         @RequestParam(required = false, defaultValue = "STUDENT") String intent,
                         HttpServletResponse response,
                         Model model) {
        try {
            User user = authService.signup(name, email, password, universityId);
            emailVerification.issue(user);
            attachSession(response, user);
            // A provider goes straight to setting up their business; there is
            // nothing for them on the student home page yet.
            return "redirect:" + ("PROVIDER".equalsIgnoreCase(intent) ? "/provider/onboarding" : "/");
        } catch (ApiException failed) {
            model.addAttribute("active", "signup");
            model.addAttribute("error", failed.getMessage());
            model.addAttribute("name", name);
            model.addAttribute("email", email);
            model.addAttribute("selectedCampus", universityId);
            model.addAttribute("intent", intent);
            model.addAttribute("campuses", universities.findByActiveTrueOrderByNameAsc());
            model.addAttribute("emailVerificationEnabled", mailer.deliversToInbox());
            return "signup";
        }
    }

    // --- sign out ------------------------------------------------------------

    /** POST only, so no prefetch or link crawler can sign anybody out. */
    @PostMapping("/logout")
    public String logout(HttpServletResponse response) {
        ResponseCookie cleared = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, "")
                .httpOnly(true).secure(secureCookies).sameSite("Lax").path("/").maxAge(0).build();
        response.addHeader("Set-Cookie", cleared.toString());
        return "redirect:/";
    }

    // --- helpers -------------------------------------------------------------

    private void attachSession(HttpServletResponse response, User user) {
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, jwtService.issue(user))
                .httpOnly(true)               // unreadable to scripts, so XSS cannot steal it
                .secure(secureCookies)        // mandatory over HTTPS; the prod profile sets it
                .sameSite("Lax")
                .path("/")
                .maxAge(jwtService.ttlSeconds())
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private String landingFor(User user) {
        if (user.getRole() == Role.ADMIN) {
            return "/admin";
        }
        if (user.getRole() == Role.PROVIDER) {
            return user.getProviderProfile() != null ? "/provider" : "/provider/onboarding";
        }
        return "/";
    }
}
