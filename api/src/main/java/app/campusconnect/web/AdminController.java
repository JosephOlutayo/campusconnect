package app.campusconnect.web;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.NotificationService;
import app.campusconnect.service.PaymentService;
import app.campusconnect.service.ReviewService;
import app.campusconnect.service.SettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

/**
 * The moderation console. Every route here is gated by hasRole('ADMIN') in
 * SecurityConfig, so there is no per-method role check to forget.
 */
@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository users;
    private final ProviderProfileRepository providers;
    private final BookingRepository bookings;
    private final ReportRepository reports;
    private final CategoryRepository categories;
    private final UniversityRepository universities;
    private final ServiceOfferingRepository services;
    private final ReviewRepository reviews;
    private final SettingsService settingsService;
    private final ReviewService reviewService;
    private final NotificationService notificationService;
    private final PaymentService paymentService;

    public AdminController(UserRepository users, ProviderProfileRepository providers,
                           BookingRepository bookings, ReportRepository reports,
                           CategoryRepository categories, UniversityRepository universities,
                           ServiceOfferingRepository services, ReviewRepository reviews,
                           SettingsService settingsService, ReviewService reviewService,
                           NotificationService notificationService, PaymentService paymentService) {
        this.users = users;
        this.providers = providers;
        this.bookings = bookings;
        this.reports = reports;
        this.categories = categories;
        this.universities = universities;
        this.services = services;
        this.reviews = reviews;
        this.settingsService = settingsService;
        this.reviewService = reviewService;
        this.notificationService = notificationService;
        this.paymentService = paymentService;
    }

    public record AdminSettingsRequest(
            @DecimalMin("0") @DecimalMax("50") double platformFeePercent,
            boolean providerAutoApprove) {
    }

    public record ActionRequest(@NotBlank String action, String note) {
    }

    public record CategoryRequest(
            @NotBlank String name,
            @NotBlank @Pattern(regexp = "^[a-z0-9-]+$") String slug,
            @NotBlank String icon,
            @NotBlank String description,
            String keywords,
            String color) {
    }

    public record UniversityRequest(
            @NotBlank String name,
            @NotBlank String shortName,
            @NotBlank @Pattern(regexp = "^[a-z0-9-]+$") String slug,
            @NotBlank String city,
            @NotBlank String state,
            double latitude,
            double longitude,
            String color,
            String emailDomains) {
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", users.count());
        stats.put("totalStudents", users.countByRole(Role.STUDENT));
        stats.put("totalProviders", providers.count());
        stats.put("activeProviders", providers.countByStatus(ProviderStatus.ACTIVE));
        stats.put("pendingProviders", providers.countByStatus(ProviderStatus.PENDING));
        stats.put("totalBookings", bookings.count());
        stats.put("grossVolumeCents", bookings.sumGrossVolume(BookingStatus.CANCELLED));
        stats.put("platformRevenueCents", bookings.sumPlatformRevenue(BookingStatus.COMPLETED));
        stats.put("openReports", reports.countByStatus(ReportStatus.OPEN));
        stats.put("platformFeePercent", settingsService.platformFeePercent());
        stats.put("providerAutoApprove", settingsService.providerAutoApprove());
        stats.put("paymentGateway", paymentService.activeGateway());
        return ApiResponse.ok(stats);
    }

    @PatchMapping("/settings")
    @Transactional
    public ApiResponse<Map<String, Boolean>> updateSettings(@Valid @RequestBody AdminSettingsRequest request) {
        // Applies to future bookings only — every existing booking carries its
        // own fee snapshot, so historical payouts never move.
        settingsService.put(PlatformSetting.PLATFORM_FEE_PERCENT, String.valueOf(request.platformFeePercent()));
        settingsService.put(PlatformSetting.PROVIDER_AUTO_APPROVE, String.valueOf(request.providerAutoApprove()));
        return ApiResponse.ok(Map.of("updated", true));
    }

    @GetMapping("/users")
    public ApiResponse<List<Map<String, Object>>> listUsers(@RequestParam(required = false) String q,
                                                            @RequestParam(required = false) String role) {
        Role parsed = null;
        if (role != null && !role.isBlank()) {
            try {
                parsed = Role.valueOf(role.toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw ApiException.badRequest("Unknown role.");
            }
        }
        return ApiResponse.ok(users.search(q == null || q.isBlank() ? "" : q.trim(), parsed).stream()
                .map(user -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", user.getId().toString());
                    row.put("name", user.getName());
                    row.put("email", user.getEmail());
                    row.put("role", user.getRole().name());
                    row.put("avatarSeed", user.getAvatarSeed());
                    row.put("suspended", user.isSuspended());
                    row.put("studentVerified", user.isStudentVerified());
                    row.put("university", user.getUniversity() == null
                            ? "" : user.getUniversity().getShortName());
                    row.put("createdAt", user.getCreatedAt().toString());
                    return row;
                })
                .toList());
    }

    @PatchMapping("/users/{id}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> updateUser(@CurrentUser AuthenticatedUser me,
                                                        @PathVariable UUID id,
                                                        @Valid @RequestBody ActionRequest request) {
        // An admin locking themselves out is not a recoverable state here.
        if (id.equals(me.id())
                && ("suspend".equals(request.action()) || "revoke_admin".equals(request.action()))) {
            throw ApiException.badRequest("You cannot do that to your own account.");
        }
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("User not found."));

        switch (request.action()) {
            case "suspend" -> {
                user.setSuspended(true);
                user.setSuspendedNote(request.note());
                // Suspending an account must also pull its listings from search.
                providers.findByUserId(id).ifPresent(profile -> {
                    profile.setStatus(ProviderStatus.SUSPENDED);
                    providers.save(profile);
                });
            }
            case "reinstate" -> {
                user.setSuspended(false);
                user.setSuspendedNote(null);
                providers.findByUserId(id).ifPresent(profile -> {
                    if (profile.getStatus() == ProviderStatus.SUSPENDED) {
                        profile.setStatus(ProviderStatus.ACTIVE);
                        providers.save(profile);
                    }
                });
            }
            case "make_admin" -> user.setRole(Role.ADMIN);
            case "revoke_admin" -> user.setRole(
                    providers.findByUserId(id).isPresent() ? Role.PROVIDER : Role.STUDENT);
            default -> throw ApiException.badRequest("Unknown action.");
        }
        users.save(user);
        return ApiResponse.ok(Map.of("updated", true));
    }

    @GetMapping("/providers")
    public ApiResponse<List<Map<String, Object>>> listProviders(@RequestParam(required = false) String status) {
        List<ProviderProfile> rows;
        if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) {
            rows = providers.findAll();
        } else {
            try {
                rows = providers.findByStatus(ProviderStatus.valueOf(status.toUpperCase()));
            } catch (IllegalArgumentException ex) {
                throw ApiException.badRequest("Unknown status.");
            }
        }
        return ApiResponse.ok(rows.stream().map(provider -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", provider.getId().toString());
            row.put("businessName", provider.getBusinessName());
            row.put("ownerName", provider.getUser().getName());
            row.put("ownerEmail", provider.getUser().getEmail());
            row.put("avatarSeed", provider.getUser().getAvatarSeed());
            row.put("university", provider.getUniversity().getShortName());
            row.put("status", provider.getStatus().name());
            row.put("verified", provider.isVerified());
            row.put("ratingAvg", provider.getRatingAvg());
            row.put("ratingCount", provider.getRatingCount());
            row.put("completedBookings", provider.getCompletedBookings());
            return row;
        }).toList());
    }

    @PatchMapping("/providers/{id}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> updateProvider(@PathVariable UUID id,
                                                            @Valid @RequestBody ActionRequest request) {
        ProviderProfile provider = providers.findById(id)
                .orElseThrow(() -> ApiException.notFound("Provider not found."));

        switch (request.action()) {
            case "approve" -> {
                provider.setStatus(ProviderStatus.ACTIVE);
                notificationService.notify(provider.getUser(), NotificationType.PROVIDER_APPROVED,
                        "You are live",
                        provider.getBusinessName() + " is now visible to students on your campus.",
                        "/provider");
            }
            case "reject" -> {
                provider.setStatus(ProviderStatus.REJECTED);
                notificationService.notify(provider.getUser(), NotificationType.PROVIDER_REJECTED,
                        "Listing not approved",
                        request.note() == null || request.note().isBlank()
                                ? "Your provider listing was not approved."
                                : request.note(),
                        "/provider/settings");
            }
            case "suspend" -> provider.setStatus(ProviderStatus.SUSPENDED);
            case "reinstate" -> provider.setStatus(ProviderStatus.ACTIVE);
            case "verify" -> provider.setVerified(true);
            case "unverify" -> provider.setVerified(false);
            default -> throw ApiException.badRequest("Unknown action.");
        }
        providers.save(provider);
        return ApiResponse.ok(Map.of("updated", true));
    }

    @GetMapping("/bookings")
    public ApiResponse<List<Map<String, Object>>> listBookings() {
        return ApiResponse.ok(bookings.findAll().stream()
                .sorted(Comparator.comparing(Booking::getStartAt).reversed())
                .limit(200)
                .map(booking -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", booking.getId().toString());
                    row.put("code", booking.getCode());
                    row.put("status", booking.getStatus().name());
                    row.put("startAt", booking.getStartAt().toString());
                    row.put("customerName", booking.getCustomer().getName());
                    row.put("providerName", booking.getProvider().getBusinessName());
                    row.put("serviceTitle", booking.getService().getTitle());
                    row.put("priceCents", booking.getPriceCents());
                    row.put("platformFeeCents", booking.getPlatformFeeCents());
                    return row;
                })
                .toList());
    }

    @GetMapping("/reports")
    public ApiResponse<List<Map<String, Object>>> listReports(@RequestParam(required = false) String status) {
        List<Report> rows = (status == null || status.isBlank() || "all".equalsIgnoreCase(status))
                ? reports.findAllByOrderByCreatedAtDesc()
                : reports.findByStatusOrderByCreatedAtDesc(ReportStatus.valueOf(status.toUpperCase()));

        return ApiResponse.ok(rows.stream().map(report -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", report.getId().toString());
            row.put("targetType", report.getTargetType());
            row.put("targetId", report.getTargetId().toString());
            row.put("reason", report.getReason());
            row.put("details", report.getDetails() == null ? "" : report.getDetails());
            row.put("status", report.getStatus().name());
            row.put("reporterName", report.getReporter().getName());
            row.put("targetUserId", report.getTargetUserId() == null
                    ? "" : report.getTargetUserId().toString());
            row.put("createdAt", report.getCreatedAt().toString());
            return row;
        }).toList());
    }

    @PatchMapping("/reports/{id}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> updateReport(@PathVariable UUID id,
                                                          @Valid @RequestBody ActionRequest request) {
        Report report = reports.findById(id)
                .orElseThrow(() -> ApiException.notFound("Report not found."));
        ReportStatus status = switch (request.action()) {
            case "resolve" -> ReportStatus.RESOLVED;
            case "dismiss" -> ReportStatus.DISMISSED;
            case "reviewing" -> ReportStatus.REVIEWING;
            default -> throw ApiException.badRequest("Unknown action.");
        };
        report.setStatus(status);
        report.setResolutionNote(request.note());
        report.setResolvedAt(status == ReportStatus.REVIEWING ? null : Instant.now());
        reports.save(report);
        return ApiResponse.ok(Map.of("updated", true));
    }

    @PatchMapping("/reviews/{id}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> moderateReview(@PathVariable UUID id,
                                                            @Valid @RequestBody ActionRequest request) {
        boolean hide = switch (request.action()) {
            case "hide" -> true;
            case "unhide" -> false;
            default -> throw ApiException.badRequest("Unknown action.");
        };
        reviewService.setHidden(id, hide);
        return ApiResponse.ok(Map.of("updated", true));
    }

    @GetMapping("/reviews")
    public ApiResponse<List<Map<String, Object>>> listReviews() {
        return ApiResponse.ok(reviews.findAll().stream()
                .sorted(Comparator.comparing(Review::getCreatedAt).reversed())
                .limit(200)
                .map(review -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", review.getId().toString());
                    row.put("rating", review.getRating());
                    row.put("body", review.getBody());
                    row.put("hidden", review.isHidden());
                    row.put("authorName", review.getAuthor().getName());
                    row.put("providerName", review.getProvider().getBusinessName());
                    row.put("createdAt", review.getCreatedAt().toString());
                    return row;
                })
                .toList());
    }

    /** Admin listing includes hidden categories, which the public one does not. */
    @GetMapping("/categories")
    public ApiResponse<List<Map<String, Object>>> listCategories() {
        Map<UUID, Long> counts = new LinkedHashMap<>();
        for (Object[] row : services.countActiveByCategory(null, ProviderStatus.ACTIVE)) {
            counts.put((UUID) row[0], (Long) row[1]);
        }
        return ApiResponse.ok(categories.findAll().stream()
                .sorted(Comparator.comparingInt(Category::getSortOrder))
                .map(category -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", category.getId().toString());
                    row.put("name", category.getName());
                    row.put("slug", category.getSlug());
                    row.put("icon", category.getIcon());
                    row.put("description", category.getDescription());
                    row.put("keywords", String.join(",", category.getKeywords()));
                    row.put("color", category.getColor());
                    row.put("isActive", category.isActive());
                    row.put("serviceCount", counts.getOrDefault(category.getId(), 0L));
                    return row;
                })
                .toList());
    }

    @PatchMapping("/categories")
    @Transactional
    public ApiResponse<Map<String, Boolean>> toggleCategory(@RequestBody Map<String, Object> body) {
        UUID id = UUID.fromString(String.valueOf(body.get("id")));
        Category category = categories.findById(id)
                .orElseThrow(() -> ApiException.notFound("Category not found."));
        if (body.get("isActive") != null) {
            category.setActive(Boolean.parseBoolean(String.valueOf(body.get("isActive"))));
        }
        categories.save(category);
        return ApiResponse.ok(Map.of("updated", true));
    }

    @GetMapping("/universities")
    public ApiResponse<List<Map<String, Object>>> listUniversities() {
        return ApiResponse.ok(universities.findAll().stream()
                .sorted(Comparator.comparing(University::getName))
                .map(university -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", university.getId().toString());
                    row.put("name", university.getName());
                    row.put("shortName", university.getShortName());
                    row.put("slug", university.getSlug());
                    row.put("city", university.getCity());
                    row.put("state", university.getState());
                    row.put("color", university.getColor());
                    row.put("isActive", university.isActive());
                    row.put("domains", List.copyOf(university.getEmailDomains()));
                    row.put("providerCount",
                            providers.countByUniversityIdAndStatus(university.getId(), ProviderStatus.ACTIVE));
                    row.put("userCount", 0);
                    return row;
                })
                .toList());
    }

    @PatchMapping("/universities")
    @Transactional
    public ApiResponse<Map<String, Boolean>> toggleUniversity(@RequestBody Map<String, Object> body) {
        UUID id = UUID.fromString(String.valueOf(body.get("id")));
        University university = universities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Campus not found."));
        if (body.get("isActive") != null) {
            university.setActive(Boolean.parseBoolean(String.valueOf(body.get("isActive"))));
        }
        universities.save(university);
        return ApiResponse.ok(Map.of("updated", true));
    }

    @PostMapping("/categories")
    @Transactional
    public ApiResponse<Map<String, String>> addCategory(@Valid @RequestBody CategoryRequest request) {
        if (categories.existsBySlug(request.slug())) {
            throw new ApiException("A category with that slug already exists.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        Set<String> keywords = new LinkedHashSet<>();
        if (request.keywords() != null) {
            Arrays.stream(request.keywords().split(","))
                    .map(String::trim).filter(k -> !k.isEmpty()).forEach(keywords::add);
        }
        Category category = categories.save(new Category(request.name(), request.slug(),
                request.icon(), request.description(), keywords,
                request.color() == null ? "#4F46E5" : request.color(), (int) categories.count()));
        return ApiResponse.ok(Map.of("id", category.getId().toString()));
    }

    /**
     * Adding a campus is pure data entry — no code change, no deploy. That is
     * what makes "scale to hundreds of universities" real rather than a refactor
     * waiting to happen.
     */
    @PostMapping("/universities")
    @Transactional
    public ApiResponse<Map<String, String>> addUniversity(@Valid @RequestBody UniversityRequest request) {
        if (universities.existsBySlug(request.slug())) {
            throw new ApiException("A campus with that slug already exists.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        Set<String> domains = new LinkedHashSet<>();
        if (request.emailDomains() != null) {
            Arrays.stream(request.emailDomains().split(","))
                    .map(String::trim).map(String::toLowerCase)
                    .filter(d -> !d.isEmpty()).forEach(domains::add);
        }
        for (String domain : domains) {
            if (universities.findByEmailDomain(domain).isPresent()) {
                throw new ApiException("Domain already assigned to another campus: " + domain,
                        org.springframework.http.HttpStatus.CONFLICT);
            }
        }
        University university = universities.save(new University(request.name(), request.shortName(),
                request.slug(), request.city(), request.state(), request.latitude(),
                request.longitude(), request.color() == null ? "#4F46E5" : request.color(), domains));
        return ApiResponse.ok(Map.of("id", university.getId().toString()));
    }
}
