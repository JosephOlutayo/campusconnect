package app.campusconnect.web;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.ProviderService;
import app.campusconnect.service.ReviewService;
import app.campusconnect.web.dto.BookingDtos.BookingDto;
import app.campusconnect.web.dto.CatalogDtos.*;
import app.campusconnect.web.dto.ProviderDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** The provider workspace. Everything here acts on the caller's own business. */
@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/provider")
public class ProviderController {

    private final ProviderService providerService;
    private final ReviewService reviewService;
    private final BookingRepository bookings;
    private final ServiceOfferingRepository services;
    private final TimeOffRepository timeOff;
    private final PromotionRepository promotions;
    private final AvailabilityRuleRepository rules;
    private final ReviewRepository reviews;

    public ProviderController(ProviderService providerService, ReviewService reviewService,
                              BookingRepository bookings, ServiceOfferingRepository services,
                              TimeOffRepository timeOff, PromotionRepository promotions,
                              AvailabilityRuleRepository rules, ReviewRepository reviews) {
        this.providerService = providerService;
        this.reviewService = reviewService;
        this.bookings = bookings;
        this.services = services;
        this.timeOff = timeOff;
        this.promotions = promotions;
        this.rules = rules;
        this.reviews = reviews;
    }

    @PostMapping("/onboarding")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, String>>> onboard(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody OnboardingRequest request) {
        ProviderProfile profile = providerService.onboard(me.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(Map.of(
                "providerId", profile.getId().toString(),
                "status", profile.getStatus().name())));
    }

    /**
     * The provider's OWN profile, including fields the public view withholds
     * (exact address, booking policy, moderation status). Backs the business
     * settings form.
     */
    @GetMapping("/profile")
    public ApiResponse<Map<String, Object>> ownProfile(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        Map<String, Object> row = new java.util.LinkedHashMap<>();
        row.put("id", profile.getId().toString());
        row.put("businessName", profile.getBusinessName());
        row.put("tagline", profile.getTagline() == null ? "" : profile.getTagline());
        row.put("bio", profile.getBio());
        row.put("locationLabel", profile.getLocationLabel());
        row.put("exactAddress", profile.getExactAddress() == null ? "" : profile.getExactAddress());
        row.put("locationModes", profile.getLocationModes().stream().map(Enum::name).toList());
        row.put("autoConfirmBookings", profile.isAutoConfirmBookings());
        row.put("bufferMinutes", profile.getBufferMinutes());
        row.put("minNoticeMinutes", profile.getMinNoticeMinutes());
        row.put("maxAdvanceDays", profile.getMaxAdvanceDays());
        row.put("cancellationPolicy", profile.getCancellationPolicy());
        row.put("status", profile.getStatus().name());
        row.put("verified", profile.isVerified());
        row.put("ratingAvg", profile.getRatingAvg());
        row.put("ratingCount", profile.getRatingCount());
        row.put("universityShortName", profile.getUniversity().getShortName());
        return ApiResponse.ok(row);
    }

    @GetMapping("/stats")
    public ApiResponse<ProviderStatsDto> stats(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(providerService.stats(me.id()));
    }

    @PatchMapping("/settings")
    @Transactional
    public ApiResponse<Map<String, String>> updateSettings(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody BusinessSettingsRequest request) {
        providerService.updateSettings(me.id(), request);
        return ApiResponse.ok(Map.of("updated", "true"));
    }

    // --- services ------------------------------------------------------------

    @GetMapping("/services")
    public ApiResponse<List<ServiceDto>> listServices(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        return ApiResponse.ok(services.findByProviderIdOrderByPriceCentsAsc(profile.getId())
                .stream().map(ServiceDto::of).toList());
    }

    @PostMapping("/services")
    @Transactional
    public ResponseEntity<ApiResponse<ServiceDto>> addService(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody ServiceRequest request) {
        ServiceOffering service = providerService.addService(me.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(ServiceDto.of(service)));
    }

    @PatchMapping("/services/{id}")
    @Transactional
    public ApiResponse<ServiceDto> updateService(@CurrentUser AuthenticatedUser me,
                                                 @PathVariable UUID id,
                                                 @RequestBody ServiceRequest request) {
        return ApiResponse.ok(ServiceDto.of(providerService.updateService(me.id(), id, request)));
    }

    @DeleteMapping("/services/{id}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> deleteService(@CurrentUser AuthenticatedUser me,
                                                           @PathVariable UUID id) {
        boolean deleted = providerService.removeService(me.id(), id);
        return ApiResponse.ok(Map.of("deleted", deleted, "archived", !deleted));
    }

    // --- availability --------------------------------------------------------

    @GetMapping("/availability")
    public ApiResponse<List<AvailabilityWindowDto>> availability(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        return ApiResponse.ok(rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(profile.getId())
                .stream().map(AvailabilityWindowDto::of).toList());
    }

    @PutMapping("/availability")
    @Transactional
    public ApiResponse<Map<String, Integer>> replaceAvailability(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody AvailabilityRequest request) {
        int saved = providerService.replaceAvailability(me.id(), request);
        return ApiResponse.ok(Map.of("windows", saved));
    }

    @GetMapping("/time-off")
    public ApiResponse<List<Map<String, String>>> listTimeOff(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        return ApiResponse.ok(timeOff.findByProviderIdOrderByStartAtAsc(profile.getId()).stream()
                .map(entry -> {
                    java.util.Map<String, String> row = new java.util.LinkedHashMap<>();
                    row.put("id", entry.getId().toString());
                    row.put("startAt", entry.getStartAt().toString());
                    row.put("endAt", entry.getEndAt().toString());
                    row.put("reason", entry.getReason() == null ? "" : entry.getReason());
                    return row;
                })
                .toList());
    }

    @PostMapping("/time-off")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, String>>> addTimeOff(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody TimeOffRequest request) {
        TimeOff entry = providerService.addTimeOff(me.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(Map.of("id", entry.getId().toString())));
    }

    @DeleteMapping("/time-off/{id}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> removeTimeOff(@CurrentUser AuthenticatedUser me,
                                                           @PathVariable UUID id) {
        providerService.removeTimeOff(me.id(), id);
        return ApiResponse.ok(Map.of("deleted", true));
    }

    // --- bookings, reviews, promotions ---------------------------------------

    @GetMapping("/bookings")
    public ApiResponse<List<BookingDto>> providerBookings(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        return ApiResponse.ok(bookings.findByProviderIdOrderByStartAtDesc(profile.getId()).stream()
                .map(booking -> {
                    var review = reviews.findByBookingId(booking.getId());
                    return BookingDto.of(booking, me.id(), review.isPresent(),
                            review.map(Review::getRating).orElse(null));
                })
                .toList());
    }

    @GetMapping("/reviews")
    public ApiResponse<List<ReviewDto>> providerReviews(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        return ApiResponse.ok(reviewService.forProvider(profile.getId()).stream()
                .map(ReviewDto::of).toList());
    }

    @GetMapping("/promotions")
    public ApiResponse<List<Map<String, String>>> listPromotions(@CurrentUser AuthenticatedUser me) {
        ProviderProfile profile = providerService.requireOwned(me.id());
        return ApiResponse.ok(promotions.findByProviderIdOrderByCreatedAtDesc(profile.getId()).stream()
                .map(promotion -> {
                    java.util.Map<String, String> row = new java.util.LinkedHashMap<>();
                    row.put("id", promotion.getId().toString());
                    row.put("code", promotion.getCode());
                    row.put("description", promotion.getDescription());
                    row.put("discountType", promotion.getDiscountType().name());
                    row.put("discountValue", String.valueOf(promotion.getDiscountValue()));
                    row.put("redemptions", String.valueOf(promotion.getRedemptions()));
                    row.put("maxRedemptions", promotion.getMaxRedemptions() == null
                            ? "" : String.valueOf(promotion.getMaxRedemptions()));
                    row.put("startsAt", promotion.getStartsAt().toString());
                    row.put("endsAt", promotion.getEndsAt().toString());
                    row.put("active", String.valueOf(promotion.isActive()));
                    return row;
                })
                .toList());
    }

    @PostMapping("/promotions")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, String>>> addPromotion(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody PromotionRequest request) {
        Promotion promotion = providerService.addPromotion(me.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(Map.of("id", promotion.getId().toString())));
    }
}
