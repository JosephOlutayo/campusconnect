package app.campusconnect.web;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.AuthService;
import app.campusconnect.service.NotificationService;
import app.campusconnect.service.ReviewService;
import app.campusconnect.web.dto.AuthDtos.ProfileUpdateRequest;
import app.campusconnect.web.dto.AuthDtos.UserDto;
import app.campusconnect.web.dto.BookingDtos.CreateReviewRequest;
import app.campusconnect.web.dto.BookingDtos.ReviewResponseRequest;
import app.campusconnect.web.dto.CatalogDtos.ReviewDto;
import app.campusconnect.web.dto.MessagingDtos.NotificationDto;
import app.campusconnect.web.dto.ProviderDtos.ReportRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Profile, favourites, reviews, notifications and reporting. */
@RestController
@Transactional(readOnly = true)
@RequestMapping("/api")
public class AccountController {

    private final UserRepository users;
    private final UniversityRepository universities;
    private final FavoriteRepository favorites;
    private final ProviderProfileRepository providers;
    private final ReportRepository reports;
    private final ReviewRepository reviews;
    private final ServiceOfferingRepository services;
    private final MessageRepository messages;
    private final AuthService authService;
    private final ReviewService reviewService;
    private final NotificationService notificationService;
    private final app.campusconnect.service.SearchService searchService;

    public AccountController(UserRepository users, UniversityRepository universities,
                             FavoriteRepository favorites, ProviderProfileRepository providers,
                             ReportRepository reports, ReviewRepository reviews,
                             ServiceOfferingRepository services, MessageRepository messages,
                             AuthService authService, ReviewService reviewService,
                             NotificationService notificationService,
                             app.campusconnect.service.SearchService searchService) {
        this.users = users;
        this.universities = universities;
        this.favorites = favorites;
        this.providers = providers;
        this.reports = reports;
        this.reviews = reviews;
        this.services = services;
        this.messages = messages;
        this.authService = authService;
        this.reviewService = reviewService;
        this.notificationService = notificationService;
        this.searchService = searchService;
    }

    @PatchMapping("/profile")
    @Transactional
    public ApiResponse<UserDto> updateProfile(@CurrentUser AuthenticatedUser me,
                                              @Valid @RequestBody ProfileUpdateRequest request) {
        User user = authService.require(me.id());
        University university = universities.findById(request.universityId())
                .orElseThrow(() -> ApiException.badRequest("Pick a university from the list."));

        // Switching campus re-evaluates the student badge: it only holds while
        // the verified email domain still belongs to the selected university.
        boolean keepsBadge = user.isStudentVerified()
                && authService.campusForEmail(user.getEmail())
                    .map(match -> match.getId().equals(university.getId()))
                    .orElse(false);

        user.setName(request.name().trim());
        user.setBio(request.bio());
        user.setPhone(request.phone());
        user.setUniversity(university);
        user.setStudentVerifiedAt(keepsBadge ? user.getStudentVerifiedAt() : null);

        return ApiResponse.ok(UserDto.of(users.save(user)));
    }

    // --- favourites ----------------------------------------------------------

    @PostMapping("/favorites/{providerId}")
    @Transactional
    public ApiResponse<Map<String, Boolean>> save(@CurrentUser AuthenticatedUser me,
                                                  @PathVariable UUID providerId) {
        if (!favorites.existsByUserIdAndProviderId(me.id(), providerId)) {
            User user = authService.require(me.id());
            ProviderProfile provider = providers.findById(providerId)
                    .orElseThrow(() -> ApiException.notFound("Provider not found."));
            favorites.save(new Favorite(user, provider));
        }
        return ApiResponse.ok(Map.of("saved", true));
    }

    @DeleteMapping("/favorites/{providerId}")
    @org.springframework.transaction.annotation.Transactional
    public ApiResponse<Map<String, Boolean>> unsave(@CurrentUser AuthenticatedUser me,
                                                    @PathVariable UUID providerId) {
        favorites.deleteByUserIdAndProviderId(me.id(), providerId);
        return ApiResponse.ok(Map.of("saved", false));
    }

    @GetMapping("/favorites")
    public ApiResponse<List<UUID>> listFavorites(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(favorites.findProviderIdsForUser(me.id()));
    }

    /** Full provider cards for the saved-providers page, newest save first. */
    @GetMapping("/favorites/cards")
    public ApiResponse<List<app.campusconnect.web.dto.CatalogDtos.ProviderCardDto>> favoriteCards(
            @CurrentUser AuthenticatedUser me) {
        List<UUID> providerIds = favorites.findByUserIdOrderByCreatedAtDesc(me.id()).stream()
                .map(favorite -> favorite.getProvider().getId())
                .toList();
        return ApiResponse.ok(searchService.cardsForProviders(providerIds));
    }

    // --- reviews -------------------------------------------------------------

    @PostMapping("/reviews")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, String>>> createReview(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody CreateReviewRequest request) {
        Review review = reviewService.create(request.bookingId(), me.id(),
                request.rating(), request.body());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(Map.of("id", review.getId().toString())));
    }

    @PostMapping("/reviews/{id}/response")
    @Transactional
    public ApiResponse<Map<String, Boolean>> respond(@CurrentUser AuthenticatedUser me,
                                                     @PathVariable UUID id,
                                                     @Valid @RequestBody ReviewResponseRequest request) {
        reviewService.respond(id, me.id(), request.response());
        return ApiResponse.ok(Map.of("responded", true));
    }

    @GetMapping("/reviews/mine")
    public ApiResponse<List<ReviewDto>> myReviews(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(reviewService.byAuthor(me.id()).stream().map(ReviewDto::of).toList());
    }

    @GetMapping("/reviews/pending")
    public ApiResponse<List<Map<String, String>>> pendingReviews(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(reviewService.awaitingReview(me.id()).stream()
                .map(booking -> {
                    java.util.Map<String, String> row = new java.util.LinkedHashMap<>();
                    row.put("bookingId", booking.getId().toString());
                    row.put("providerId", booking.getProvider().getId().toString());
                    row.put("providerName", booking.getProvider().getBusinessName());
                    row.put("avatarSeed", booking.getProvider().getUser().getAvatarSeed());
                    row.put("serviceTitle", booking.getService().getTitle());
                    return row;
                })
                .toList());
    }

    // --- notifications -------------------------------------------------------

    @GetMapping("/notifications")
    public ApiResponse<Map<String, Object>> notifications(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(Map.of(
                "notifications", notificationService.recent(me.id()).stream()
                        .map(NotificationDto::of).toList(),
                "unread", notificationService.unreadCount(me.id()),
                "unreadMessages", messages.countUnreadForUser(me.id())));
    }

    @PostMapping("/notifications/read")
    @Transactional
    public ApiResponse<Map<String, Integer>> markRead(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(Map.of("read", notificationService.markAllRead(me.id())));
    }

    // --- trust and safety ----------------------------------------------------

    /**
     * Resolves the account behind whatever was reported, so an admin can act on
     * the user without chasing the target through three tables.
     */
    private UUID resolveTargetUser(String targetType, UUID targetId) {
        return switch (targetType.toUpperCase()) {
            case "USER" -> targetId;
            case "PROVIDER" -> providers.findById(targetId)
                    .map(provider -> provider.getUser().getId()).orElse(null);
            case "SERVICE" -> services.findById(targetId)
                    .map(service -> service.getProvider().getUser().getId()).orElse(null);
            case "REVIEW" -> reviews.findById(targetId)
                    .map(review -> review.getAuthor().getId()).orElse(null);
            case "MESSAGE" -> messages.findById(targetId)
                    .map(message -> message.getSender().getId()).orElse(null);
            default -> null;
        };
    }

    @PostMapping("/reports")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> report(
            @CurrentUser AuthenticatedUser me, @Valid @RequestBody ReportRequest request) {
        User reporter = authService.require(me.id());
        reports.save(new Report(reporter, request.targetType().toUpperCase(), request.targetId(),
                resolveTargetUser(request.targetType(), request.targetId()),
                request.reason(), request.details()));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(Map.of("submitted", true)));
    }
}
