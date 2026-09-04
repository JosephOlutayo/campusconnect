package app.campusconnect.web;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.PaymentService;
import app.campusconnect.service.SettingsService;
import app.campusconnect.web.dto.StatsDtos.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Aggregate numbers for the home page, campus pages and the student dashboard.
 *
 * These exist so a page can render its headline figures in one round trip
 * instead of six.
 */
@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/stats")
public class StatsController {

    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final BookingRepository bookings;
    private final UniversityRepository universities;
    private final ReviewRepository reviews;
    private final FavoriteRepository favorites;
    private final MessageRepository messages;
    private final NotificationRepository notifications;
    private final SettingsService settingsService;
    private final PaymentService paymentService;

    public StatsController(ProviderProfileRepository providers, ServiceOfferingRepository services,
                           BookingRepository bookings, UniversityRepository universities,
                           ReviewRepository reviews, FavoriteRepository favorites,
                           MessageRepository messages, NotificationRepository notifications,
                           SettingsService settingsService, PaymentService paymentService) {
        this.providers = providers;
        this.services = services;
        this.bookings = bookings;
        this.universities = universities;
        this.reviews = reviews;
        this.favorites = favorites;
        this.messages = messages;
        this.notifications = notifications;
        this.settingsService = settingsService;
        this.paymentService = paymentService;
    }

    /**
     * @param university optional campus slug. Omitted means platform-wide, which
     *                   is what a signed-out visitor with no campus sees.
     */
    @GetMapping("/campus")
    public ApiResponse<CampusOverview> campus(@RequestParam(required = false) String university) {
        UUID universityId = null;
        if (university != null && !university.isBlank() && !"all".equalsIgnoreCase(university)) {
            universityId = universities.findBySlug(university)
                    .map(University::getId)
                    .orElseThrow(() -> ApiException.notFound("Campus not found."));
        }

        long providerCount = universityId == null
                ? providers.countByStatus(ProviderStatus.ACTIVE)
                : providers.countByUniversityIdAndStatus(universityId, ProviderStatus.ACTIVE);

        List<ProviderProfile> scope = universityId == null
                ? providers.findByStatus(ProviderStatus.ACTIVE)
                : providers.findByUniversityIdAndStatus(universityId, ProviderStatus.ACTIVE);

        Set<UUID> providerIds = new HashSet<>();
        scope.forEach(provider -> providerIds.add(provider.getId()));

        long serviceCount = 0;
        Map<UUID, Category> categoryByService = new HashMap<>();
        for (ProviderProfile provider : scope) {
            for (ServiceOffering service : services.findByProviderIdAndActiveTrueOrderByPriceCentsAsc(provider.getId())) {
                serviceCount++;
                categoryByService.put(service.getId(), service.getCategory());
            }
        }

        Double average = providers.averageRating(universityId, ProviderStatus.ACTIVE);
        LocalDate weekAgo = LocalDate.now().minusDays(7);
        long newThisWeek = scope.stream()
                .filter(provider -> provider.getCreatedAt().isAfter(
                        weekAgo.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()))
                .count();

        // Bookings created this month, bucketed by the category of their service.
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        Map<String, long[]> totals = new HashMap<>();
        Map<String, String> iconByName = new HashMap<>();
        long bookingsThisMonth = 0;

        for (UUID providerId : providerIds) {
            for (Booking booking : bookings.findForProviderBetween(
                    providerId, monthStart, LocalDateTime.now().plusDays(1))) {
                if (booking.getStatus() == BookingStatus.CANCELLED) {
                    continue;
                }
                Category category = categoryByService.get(booking.getService().getId());
                if (category == null) {
                    continue;
                }
                bookingsThisMonth++;
                totals.computeIfAbsent(category.getName(), key -> new long[1])[0]++;
                iconByName.putIfAbsent(category.getName(), category.getIcon());
            }
        }

        List<CategoryCount> ranked = totals.entrySet().stream()
                .map(entry -> new CategoryCount(entry.getKey(),
                        iconByName.getOrDefault(entry.getKey(), "✨"), entry.getValue()[0]))
                .sorted(Comparator.comparingLong(CategoryCount::count).reversed())
                .limit(6)
                .toList();

        return ApiResponse.ok(new CampusOverview(
                providerCount, serviceCount,
                average == null ? 0 : Math.round(average * 10.0) / 10.0,
                newThisWeek, bookingsThisMonth, ranked));
    }

    /** Public platform config the UI needs to explain pricing. */
    @GetMapping("/settings")
    public ApiResponse<Map<String, Object>> publicSettings() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("platformFeePercent", settingsService.platformFeePercent());
        row.put("paymentGateway", paymentService.activeGateway());
        return ApiResponse.ok(row);
    }

    @GetMapping("/me")
    public ApiResponse<MeSummary> me(@CurrentUser AuthenticatedUser user) {
        if (user == null) {
            throw ApiException.unauthorized("Sign in first.");
        }
        UUID id = user.id();

        long pendingRequests = providers.findByUserId(id)
                .map(profile -> bookings.countByProviderIdAndStatus(profile.getId(), BookingStatus.PENDING))
                .orElse(0L);

        return ApiResponse.ok(new MeSummary(
                bookings.countByCustomerIdAndStatus(id, BookingStatus.COMPLETED),
                bookings.findUpcomingForCustomer(id, BookingStatus.BLOCKING, LocalDateTime.now()).size(),
                reviews.findByAuthorIdOrderByCreatedAtDesc(id).size(),
                favorites.countByUserId(id),
                bookings.sumCustomerSpend(id),
                messages.countUnreadForUser(id),
                notifications.countByUserIdAndReadAtIsNull(id),
                pendingRequests));
    }
}
