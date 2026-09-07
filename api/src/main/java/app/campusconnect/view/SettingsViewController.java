package app.campusconnect.view;

import app.campusconnect.domain.University;
import app.campusconnect.domain.User;
import app.campusconnect.repository.UniversityRepository;
import app.campusconnect.repository.UserRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.AuthService;
import app.campusconnect.service.EmailVerificationService;
import app.campusconnect.service.Mailer;
import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * The account settings page, plus the email-verification link that arrives from
 * an inbox.
 *
 * The verification link is deliberately a GET on a public route: whoever clicks
 * it may be in a browser that has never signed in to this app, and asking them
 * to sign in first would defeat the point of proving they can read that inbox.
 */
@Controller
public class SettingsViewController {

    private final AuthService authService;
    private final EmailVerificationService emailVerification;
    private final UserRepository users;
    private final UniversityRepository universities;
    private final Mailer mailer;

    public SettingsViewController(AuthService authService,
                                  EmailVerificationService emailVerification,
                                  UserRepository users,
                                  UniversityRepository universities,
                                  Mailer mailer) {
        this.authService = authService;
        this.emailVerification = emailVerification;
        this.users = users;
        this.universities = universities;
        this.mailer = mailer;
    }

    @GetMapping("/settings")
    @Transactional(readOnly = true)
    public String settings(@RequestParam(required = false) String error,
                           @RequestParam(required = false) String notice,
                           @CurrentUser AuthenticatedUser me,
                           Model model) {
        if (me == null) {
            return "redirect:/login?next=/settings";
        }
        User user = authService.require(me.id());
        // open-in-view is off, so the campus is read here rather than lazily
        // from the template.
        if (user.getUniversity() != null) {
            user.getUniversity().getShortName();
        }

        model.addAttribute("active", "settings");
        model.addAttribute("user", user);
        model.addAttribute("universityId", user.getUniversity() == null
                ? null : user.getUniversity().getId());
        model.addAttribute("campuses", universities.findByActiveTrueOrderByNameAsc());
        model.addAttribute("error", error);
        model.addAttribute("notice", notice);
        // Without a real mail server, offering "send me a link" would be a
        // button that quietly does nothing. The page says so instead.
        model.addAttribute("emailDeliveryOn", mailer.deliversToInbox());
        return "settings";
    }

    @PostMapping("/settings/profile")
    @Transactional
    public String saveProfile(@RequestParam String name,
                              @RequestParam(required = false) String bio,
                              @RequestParam(required = false) String phone,
                              @RequestParam UUID universityId,
                              @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/settings";
        }
        if (name.isBlank()) {
            return back("Your name cannot be empty.", null);
        }
        User user = authService.require(me.id());
        University campus = universities.findById(universityId)
                .orElseThrow(() -> ApiException.badRequest("Pick a university from the list."));

        // Switching campus re-evaluates the student badge: it only holds while
        // the verified address still belongs to the selected university.
        boolean keepsBadge = user.isStudentVerified()
                && authService.campusForEmail(user.getEmail())
                    .map(match -> match.getId().equals(campus.getId()))
                    .orElse(false);

        user.setName(name.trim());
        user.setBio(bio);
        user.setPhone(phone);
        user.setUniversity(campus);
        user.setStudentVerifiedAt(keepsBadge ? user.getStudentVerifiedAt() : null);
        users.save(user);

        return back(null, "Profile saved.");
    }

    /*
     * Deliberately not @Transactional — see the note on verifyEmail.
     */
    @PostMapping("/settings/resend-verification")
    public String resendVerification(@CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/settings";
        }
        User user = authService.require(me.id());
        if (user.getEmailVerifiedAt() != null) {
            return back(null, "Your email is already confirmed.");
        }
        try {
            emailVerification.issue(user);
            return back(null, "Check " + user.getEmail() + " for a new link.");
        } catch (ApiException refused) {
            return back(refused.getMessage(), null);
        }
    }

    /* Deliberately not @Transactional — see the note on verifyEmail. */
    @PostMapping("/settings/email")
    public String changeEmail(@RequestParam String newEmail,
                              @RequestParam String password,
                              @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/settings";
        }
        User user = authService.require(me.id());
        try {
            // Nothing moves here. The link sent to the new address is what
            // actually changes the account.
            emailVerification.requestEmailChange(user, newEmail, password);
            return back(null, "Check " + newEmail.trim().toLowerCase()
                    + " for a link. Your address changes once you follow it.");
        } catch (ApiException refused) {
            return back(refused.getMessage(), null);
        }
    }

    /**
     * Where a verification email lands. Public by design — see the class note.
     *
     * Deliberately not @Transactional. EmailVerificationService.consume runs its
     * own transaction; opening one here too means a bad token marks the shared
     * transaction rollback-only, and catching the exception then fails the
     * commit with UnexpectedRollbackException — a 500 in place of
     * "that link has expired, ask for a new one".
     */
    @GetMapping("/verify-email")
    public String verifyEmail(@RequestParam(required = false) String token, Model model) {
        model.addAttribute("active", "settings");
        try {
            User user = emailVerification.consume(token);
            model.addAttribute("ok", true);
            model.addAttribute("email", user.getEmail());
            model.addAttribute("studentVerified", user.isStudentVerified());
        } catch (ApiException failed) {
            model.addAttribute("ok", false);
            model.addAttribute("message", failed.getMessage());
        }
        return "verify-email";
    }

    // --- helpers -------------------------------------------------------------

    /**
     * Messages travel in the URL. The app is STATELESS, so flash attributes are
     * created and then silently discarded before the redirect is followed.
     */
    private String back(String error, String notice) {
        String key = error != null ? "error" : "notice";
        String value = error != null ? error : notice;
        if (value == null) {
            return "redirect:/settings";
        }
        return "redirect:/settings?" + key + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
