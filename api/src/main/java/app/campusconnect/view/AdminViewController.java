package app.campusconnect.view;

import app.campusconnect.domain.BookingStatus;
import app.campusconnect.domain.PlatformSetting;
import app.campusconnect.domain.ProviderStatus;
import app.campusconnect.domain.ReportStatus;
import app.campusconnect.domain.Role;
import app.campusconnect.domain.University;
import app.campusconnect.domain.User;
import app.campusconnect.repository.BookingRepository;
import app.campusconnect.repository.EmailVerificationTokenRepository;
import app.campusconnect.repository.FavoriteRepository;
import app.campusconnect.repository.MessageRepository;
import app.campusconnect.repository.NotificationRepository;
import app.campusconnect.repository.ReviewRepository;
import app.campusconnect.repository.CategoryRepository;
import app.campusconnect.repository.ProviderProfileRepository;
import app.campusconnect.repository.ReportRepository;
import app.campusconnect.repository.UniversityRepository;
import app.campusconnect.repository.UserRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.SettingsService;
import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The admin console.
 *
 * Access is enforced by SecurityConfig, which requires the ADMIN role for
 * /admin/** — not by hiding links, which would only make the pages harder to
 * find rather than harder to reach.
 */
@Controller
@RequestMapping("/admin")
public class AdminViewController {

    private final UserRepository users;
    private final ProviderProfileRepository providers;
    private final BookingRepository bookings;
    private final UniversityRepository universities;
    private final CategoryRepository categories;
    private final ReportRepository reports;
    private final SettingsService settings;
    private final ReviewRepository reviews;
    private final MessageRepository messages;
    private final FavoriteRepository favorites;
    private final NotificationRepository notifications;
    private final EmailVerificationTokenRepository verificationTokens;

    public AdminViewController(UserRepository users,
                               ProviderProfileRepository providers,
                               BookingRepository bookings,
                               UniversityRepository universities,
                               CategoryRepository categories,
                               ReportRepository reports,
                               SettingsService settings,
                               ReviewRepository reviews,
                               MessageRepository messages,
                               FavoriteRepository favorites,
                               NotificationRepository notifications,
                               EmailVerificationTokenRepository verificationTokens) {
        this.users = users;
        this.providers = providers;
        this.bookings = bookings;
        this.universities = universities;
        this.categories = categories;
        this.reports = reports;
        this.settings = settings;
        this.reviews = reviews;
        this.messages = messages;
        this.favorites = favorites;
        this.notifications = notifications;
        this.verificationTokens = verificationTokens;
    }

    // --- overview ------------------------------------------------------------

    @GetMapping
    @Transactional(readOnly = true)
    public String overview(Model model) {
        model.addAttribute("active", "admin");
        model.addAttribute("userCount", users.count());
        model.addAttribute("providerCount", providers.countByStatus(ProviderStatus.ACTIVE));
        model.addAttribute("pendingProviders", providers.countByStatus(ProviderStatus.PENDING));
        model.addAttribute("campusCount", universities.count());
        model.addAttribute("bookingCount", bookings.count());
        model.addAttribute("openReports", reports.countByStatus(ReportStatus.OPEN));
        model.addAttribute("feePercent", settings.platformFeePercent());
        model.addAttribute("autoApprove", settings.providerAutoApprove());
        return "admin/overview";
    }

    // --- campuses ------------------------------------------------------------

    @GetMapping("/universities")
    @Transactional(readOnly = true)
    public String campuses(@RequestParam(required = false) String error, Model model) {
        model.addAttribute("active", "admin");
        model.addAttribute("error", error);
        // findAll, not the active-only finder: a hidden campus must still be
        // visible here or it cannot be brought back.
        model.addAttribute("campuses", universities.findAll().stream()
                .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .map(this::campusRow)
                .toList());
        return "admin/universities";
    }

    @PostMapping("/universities")
    @Transactional
    public String addCampus(@RequestParam String name,
                            @RequestParam String shortName,
                            @RequestParam String slug,
                            @RequestParam String city,
                            @RequestParam String state,
                            @RequestParam(required = false, defaultValue = "0") double latitude,
                            @RequestParam(required = false, defaultValue = "0") double longitude,
                            @RequestParam(required = false) String emailDomains,
                            @RequestParam(required = false, defaultValue = "#4F46E5") String color) {
        String cleanSlug = slug.trim().toLowerCase();
        if (universities.existsBySlug(cleanSlug)) {
            return redirectWithError("/admin/universities", "A campus with that slug already exists.");
        }

        // Comma-separated, because that is what a person types. Split here so the
        // form never has to know the storage shape.
        Set<String> domains = new LinkedHashSet<>();
        if (emailDomains != null) {
            for (String raw : emailDomains.split(",")) {
                String domain = raw.trim().toLowerCase();
                if (domain.isEmpty()) {
                    continue;
                }
                if (universities.findByEmailDomain(domain).isPresent()) {
                    return redirectWithError("/admin/universities",
                            "Domain already assigned to another campus: " + domain);
                }
                domains.add(domain);
            }
        }

        universities.save(new University(name.trim(), shortName.trim(), cleanSlug,
                city.trim(), state.trim(), latitude, longitude, color, domains));
        return "redirect:/admin/universities";
    }

    @PostMapping("/universities/{id}/toggle")
    @Transactional
    public String toggleCampus(@PathVariable UUID id) {
        University campus = universities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Campus not found."));
        campus.setActive(!campus.isActive());
        universities.save(campus);
        return "redirect:/admin/universities";
    }

    @PostMapping("/universities/{id}/delete")
    @Transactional
    public String deleteCampus(@PathVariable UUID id) {
        University campus = universities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Campus not found."));

        // Deleting a campus out from under real accounts would leave them
        // pointing at a row that no longer exists. Hiding is the right tool once
        // a campus has been used.
        long accounts = users.countByUniversityId(id);
        long profiles = providers.countByUniversityId(id);
        if (accounts > 0 || profiles > 0) {
            return redirectWithError("/admin/universities",
                    "This campus has " + accounts + " account(s) and " + profiles
                            + " provider(s) on it, so it cannot be deleted. Hide it instead.");
        }
        universities.delete(campus);
        return "redirect:/admin/universities";
    }

    // --- people --------------------------------------------------------------

    @GetMapping("/users")
    @Transactional(readOnly = true)
    public String userList(@RequestParam(required = false) String q,
                           @RequestParam(required = false) String error,
                           @RequestParam(required = false) String notice,
                           Model model) {
        model.addAttribute("active", "admin");
        model.addAttribute("q", q);
        model.addAttribute("error", error);
        model.addAttribute("notice", notice);
        // "" rather than null: PostgreSQL cannot type a null parameter used both
        // in an `is null` test and inside concat().
        var people = users.search(q == null || q.isBlank() ? "" : q.trim(), null);
        // The template shows each person's campus, and open-in-view is off, so
        // the association has to be loaded before the transaction closes.
        people.forEach(person -> {
            if (person.getUniversity() != null) {
                person.getUniversity().getShortName();
            }
        });
        model.addAttribute("people", people);
        return "admin/users";
    }

    @PostMapping("/users/{id}/suspend")
    @Transactional
    public String toggleSuspended(@PathVariable UUID id, @CurrentUser AuthenticatedUser me) {
        User person = users.findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found."));

        // Suspending yourself locks you out of the console that would undo it.
        if (me != null && person.getId().equals(me.id())) {
            return redirectWithError("/admin/users", "You cannot suspend your own account.");
        }
        person.setSuspended(!person.isSuspended());
        users.save(person);
        return "redirect:/admin/users";
    }

    /**
     * Deletes an account outright.
     *
     * Only ever an account that has done nothing. A person who has booked,
     * reviewed or messaged is part of somebody else's history: deleting them
     * would either break those records or quietly rewrite what another person
     * can see about their own appointment. Suspending is the tool for that, and
     * the refusal says so rather than just failing.
     *
     * The rows removed alongside are the ones nobody else can see — saved
     * providers, this account's own notifications, and any unused verification
     * link.
     */
    @PostMapping("/users/{id}/delete")
    @Transactional
    public String deleteUser(@PathVariable UUID id, @CurrentUser AuthenticatedUser me) {
        User person = users.findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found."));

        if (me != null && person.getId().equals(me.id())) {
            return redirectWithError("/admin/users", "You cannot delete your own account.");
        }
        if (person.getRole() == Role.ADMIN && users.countByRole(Role.ADMIN) <= 1) {
            return redirectWithError("/admin/users",
                    "This is the only administrator. Deleting it would lock everyone out of the console.");
        }
        if (providers.findByUserId(id).isPresent()) {
            return redirectWithError("/admin/users",
                    "This account runs a business. Suspend the provider under Providers instead.");
        }

        long bookings_ = bookings.countByCustomerId(id);
        long reviews_ = reviews.countByAuthorId(id);
        long messages_ = messages.countBySenderId(id);
        if (bookings_ > 0 || reviews_ > 0 || messages_ > 0) {
            return redirectWithError("/admin/users",
                    "This account has " + bookings_ + " booking(s), " + reviews_ + " review(s) and "
                            + messages_ + " message(s), which belong to other people's records too. "
                            + "Suspend it instead.");
        }

        favorites.deleteByUserId(id);
        notifications.deleteByUserId(id);
        verificationTokens.deleteByUser(person);
        users.delete(person);
        return "redirect:/admin/users?notice="
                + URLEncoder.encode("Deleted " + person.getEmail() + ".", StandardCharsets.UTF_8);
    }

    // --- providers -----------------------------------------------------------

    @GetMapping("/providers")
    @Transactional(readOnly = true)
    public String providerList(Model model) {
        model.addAttribute("active", "admin");
        var all = providers.findAll();
        all.forEach(p -> {
            p.getUser().getName();
            if (p.getUniversity() != null) {
                p.getUniversity().getShortName();
            }
        });
        model.addAttribute("providers", all);
        return "admin/providers";
    }

    @PostMapping("/providers/{id}/{action}")
    @Transactional
    public String updateProvider(@PathVariable UUID id, @PathVariable String action) {
        var provider = providers.findById(id)
                .orElseThrow(() -> ApiException.notFound("Provider not found."));
        switch (action) {
            case "approve" -> provider.setStatus(ProviderStatus.ACTIVE);
            case "suspend" -> provider.setStatus(ProviderStatus.SUSPENDED);
            // The verified badge is the platform vouching for a business, so it
            // is a deliberate switch rather than something granted on signup.
            case "verify" -> provider.setVerified(!provider.isVerified());
            default -> throw ApiException.badRequest("Unknown action.");
        }
        providers.save(provider);
        return "redirect:/admin/providers";
    }

    // --- categories ----------------------------------------------------------

    @GetMapping("/categories")
    @Transactional(readOnly = true)
    public String categoryList(Model model) {
        model.addAttribute("active", "admin");
        model.addAttribute("categories", categories.findAll().stream()
                .sorted((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()))
                .toList());
        return "admin/categories";
    }

    @PostMapping("/categories/{id}/toggle")
    @Transactional
    public String toggleCategory(@PathVariable UUID id) {
        var category = categories.findById(id)
                .orElseThrow(() -> ApiException.notFound("Category not found."));
        category.setActive(!category.isActive());
        categories.save(category);
        return "redirect:/admin/categories";
    }

    // --- reports -------------------------------------------------------------

    @GetMapping("/reports")
    @Transactional(readOnly = true)
    public String reportList(Model model) {
        model.addAttribute("active", "admin");
        var all = reports.findAllByOrderByCreatedAtDesc();
        // open-in-view is off, so the reporter is read here rather than lazily
        // during rendering.
        all.forEach(report -> report.getReporter().getName());
        model.addAttribute("reports", all);
        return "admin/reports";
    }

    @PostMapping("/reports/{id}/resolve")
    @Transactional
    public String resolveReport(@PathVariable UUID id,
                                @RequestParam(required = false) String note) {
        var report = reports.findById(id)
                .orElseThrow(() -> ApiException.notFound("Report not found."));
        report.setStatus(ReportStatus.RESOLVED);
        report.setResolutionNote(note);
        report.setResolvedAt(java.time.Instant.now());
        reports.save(report);
        return "redirect:/admin/reports";
    }

    // --- bookings ------------------------------------------------------------

    /**
     * Every booking on the platform. Read-only: an admin can see what happened
     * so a dispute can be answered, but confirming or cancelling on someone
     * else's behalf belongs to the two people in the booking.
     */
    @GetMapping("/bookings")
    @Transactional(readOnly = true)
    public String bookingList(Model model) {
        model.addAttribute("active", "admin");
        var recent = bookings.findTop200ByOrderByCreatedAtDesc();
        recent.forEach(booking -> {
            booking.getCustomer().getName();
            booking.getProvider().getBusinessName();
            booking.getService().getTitle();
        });
        model.addAttribute("bookings", recent);
        return "admin/bookings";
    }

    // --- settings ------------------------------------------------------------

    @GetMapping("/settings")
    @Transactional(readOnly = true)
    public String settingsForm(@RequestParam(required = false) String saved, Model model) {
        model.addAttribute("active", "admin");
        model.addAttribute("saved", saved != null);
        model.addAttribute("feePercent", settings.platformFeePercent());
        model.addAttribute("autoApprove", settings.providerAutoApprove());
        return "admin/settings";
    }

    @PostMapping("/settings")
    @Transactional
    public String saveSettings(@RequestParam double feePercent,
                               @RequestParam(required = false) String autoApprove) {
        if (feePercent < 0 || feePercent > 50) {
            return redirectWithError("/admin/settings", "The fee must be between 0 and 50 percent.");
        }
        settings.put(PlatformSetting.PLATFORM_FEE_PERCENT, String.valueOf(feePercent));
        settings.put(PlatformSetting.PROVIDER_AUTO_APPROVE, String.valueOf(autoApprove != null));
        // Existing bookings keep the split they were created with — the fee is
        // snapshotted per booking, so changing it never rewrites history.
        return "redirect:/admin/settings?saved=1";
    }

    // --- helpers -------------------------------------------------------------

    /** Errors travel in the URL: the application is STATELESS, so flash storage is dropped. */
    private String redirectWithError(String path, String message) {
        return "redirect:" + path + "?error=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }

    /** Flattened for the template, including the counts that gate deletion. */
    private CampusRow campusRow(University campus) {
        return new CampusRow(campus.getId(), campus.getName(), campus.getShortName(),
                campus.getCity(), campus.getState(), campus.getColor(), campus.isActive(),
                List.copyOf(campus.getEmailDomains()),
                users.countByUniversityId(campus.getId()),
                providers.countByUniversityId(campus.getId()));
    }

    public record CampusRow(UUID id, String name, String shortName, String city, String state,
                            String color, boolean active, List<String> domains,
                            long accounts, long providerCount) {
    }
}
