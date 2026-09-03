package app.campusconnect.web;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.AvailabilityService;
import app.campusconnect.service.Geo;
import app.campusconnect.service.ReviewService;
import app.campusconnect.web.dto.CatalogDtos.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Public browsing: universities, categories and provider profiles. */
@RestController
@Transactional(readOnly = true)
@RequestMapping("/api")
public class CatalogController {

    private final UniversityRepository universities;
    private final CategoryRepository categories;
    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final PortfolioImageRepository portfolio;
    private final AvailabilityRuleRepository rules;
    private final FavoriteRepository favorites;
    private final ReviewService reviewService;
    private final AvailabilityService availabilityService;

    public CatalogController(UniversityRepository universities, CategoryRepository categories,
                             ProviderProfileRepository providers, ServiceOfferingRepository services,
                             PortfolioImageRepository portfolio, AvailabilityRuleRepository rules,
                             FavoriteRepository favorites, ReviewService reviewService,
                             AvailabilityService availabilityService) {
        this.universities = universities;
        this.categories = categories;
        this.providers = providers;
        this.services = services;
        this.portfolio = portfolio;
        this.rules = rules;
        this.favorites = favorites;
        this.reviewService = reviewService;
        this.availabilityService = availabilityService;
    }

    @GetMapping("/universities")
    public ApiResponse<List<UniversityDto>> listUniversities() {
        return ApiResponse.ok(universities.findByActiveTrueOrderByNameAsc().stream()
                .map(u -> UniversityDto.of(u,
                        providers.countByUniversityIdAndStatus(u.getId(), ProviderStatus.ACTIVE)))
                .toList());
    }

    @GetMapping("/universities/{slug}")
    public ApiResponse<UniversityDto> getUniversity(@PathVariable String slug) {
        University university = universities.findBySlug(slug)
                .orElseThrow(() -> ApiException.notFound("Campus not found."));
        return ApiResponse.ok(UniversityDto.of(university,
                providers.countByUniversityIdAndStatus(university.getId(), ProviderStatus.ACTIVE)));
    }

    @GetMapping("/categories")
    public ApiResponse<List<CategoryDto>> listCategories() {
        return ApiResponse.ok(categories.findByActiveTrueOrderBySortOrderAsc().stream()
                .map(category -> CategoryDto.of(category, 0))
                .toList());
    }

    @GetMapping("/providers/{id}")
    public ApiResponse<ProviderDetailDto> getProvider(@PathVariable UUID id,
                                                      @CurrentUser AuthenticatedUser me) {
        ProviderProfile provider = providers.findById(id)
                .orElseThrow(() -> ApiException.notFound("Provider not found."));

        boolean isOwner = me != null && provider.getUser().getId().equals(me.id());
        boolean isAdmin = me != null && me.isAdmin();
        // A paused or unapproved listing is visible only to its owner and admins.
        if (provider.getStatus() != ProviderStatus.ACTIVE && !isOwner && !isAdmin) {
            throw ApiException.notFound("Provider not found.");
        }

        List<ServiceDto> serviceDtos = services
                .findByProviderIdAndActiveTrueOrderByPriceCentsAsc(id).stream()
                .map(ServiceDto::of)
                .toList();

        LocalDateTime nextAvailable = serviceDtos.isEmpty() ? null
                : availabilityService.nextAvailable(id, serviceDtos.get(0).durationMinutes(), 21);

        University university = provider.getUniversity();

        return ApiResponse.ok(new ProviderDetailDto(
                provider.getId(), provider.getBusinessName(), provider.getTagline(), provider.getBio(),
                provider.getUser().getAvatarSeed(), provider.isVerified(),
                provider.getUser().isStudentVerified(),
                provider.getRatingAvg(), provider.getRatingCount(), provider.getCompletedBookings(),
                provider.getLocationLabel(), List.copyOf(provider.getLocationModes()),
                Geo.distanceMiles(university.getLatitude(), university.getLongitude(),
                        provider.getLatitude(), provider.getLongitude()),
                university.getShortName(), university.getSlug(), university.getId(),
                provider.getStatus().name(),
                provider.isAutoConfirmBookings(), provider.getMinNoticeMinutes(),
                provider.getMaxAdvanceDays(), provider.getCancellationPolicy(),
                serviceDtos,
                portfolio.findByProviderIdOrderBySortOrderAsc(id).stream()
                        .map(PortfolioImageDto::of).toList(),
                rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(id).stream()
                        .map(AvailabilityWindowDto::of).toList(),
                reviewService.forProvider(id).stream().map(ReviewDto::of).toList(),
                reviewService.distribution(id),
                nextAvailable,
                me != null && favorites.existsByUserIdAndProviderId(me.id(), id)));
    }
}
