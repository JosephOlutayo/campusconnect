package app.campusconnect.web.dto;

import app.campusconnect.domain.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Read models for browsing.
 *
 * These field names deliberately mirror what the existing React components
 * already consume, so the UI layer needs no reshaping.
 *
 * Note what is absent: no password hash, and no provider exactAddress. The
 * address is a privacy boundary released only through the booking detail
 * endpoint, and only once a booking is confirmed.
 */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record UniversityDto(UUID id, String name, String shortName, String slug,
                                String city, String state, String color,
                                double latitude, double longitude, long providerCount) {

        public static UniversityDto of(University u, long providerCount) {
            return new UniversityDto(u.getId(), u.getName(), u.getShortName(), u.getSlug(),
                    u.getCity(), u.getState(), u.getColor(),
                    u.getLatitude(), u.getLongitude(), providerCount);
        }
    }

    public record CategoryDto(UUID id, String name, String slug, String icon,
                              String description, String color, long serviceCount) {

        public static CategoryDto of(Category c, long serviceCount) {
            return new CategoryDto(c.getId(), c.getName(), c.getSlug(), c.getIcon(),
                    c.getDescription(), c.getColor(), serviceCount);
        }
    }

    public record ServiceDto(UUID id, String title, String description, int priceCents,
                             int durationMinutes, String categoryName, String categoryIcon,
                             UUID categoryId, List<LocationMode> locationModes,
                             boolean active, int bookingCount) {

        public static ServiceDto of(ServiceOffering s) {
            return new ServiceDto(s.getId(), s.getTitle(), s.getDescription(), s.getPriceCents(),
                    s.getDurationMinutes(), s.getCategory().getName(), s.getCategory().getIcon(),
                    s.getCategory().getId(), List.copyOf(s.effectiveLocationModes()),
                    s.isActive(), s.getBookingCount());
        }
    }

    /** The headline service shown on a search card. */
    public record HeadlineServiceDto(UUID id, String title, int priceCents,
                                     int durationMinutes, String categoryName, String categoryIcon) {
    }

    /** One search result. Shape matches the React ProviderCard component. */
    public record ProviderCardDto(UUID providerId, String businessName, String tagline,
                                  String avatarSeed, boolean isVerified,
                                  double ratingAvg, int ratingCount, int completedBookings,
                                  String universityShortName, String universitySlug,
                                  String locationLabel, List<LocationMode> locationModes,
                                  Double distanceMiles, HeadlineServiceDto headlineService,
                                  int serviceCount, int fromPriceCents,
                                  List<String> portfolioSeeds, LocalDateTime nextAvailable,
                                  Instant createdAt) {
    }

    public record PortfolioImageDto(UUID id, String seed, String url, String caption) {

        public static PortfolioImageDto of(PortfolioImage image) {
            return new PortfolioImageDto(image.getId(), image.getSeed(),
                    image.getUrl(), image.getCaption());
        }
    }

    public record AvailabilityWindowDto(String dayOfWeek, int startMinute, int endMinute) {

        public static AvailabilityWindowDto of(AvailabilityRule rule) {
            return new AvailabilityWindowDto(rule.getDayOfWeek().name(),
                    rule.getStartMinute(), rule.getEndMinute());
        }
    }

    public record ReviewDto(UUID id, int rating, String body, String authorName,
                            String authorAvatarSeed, boolean authorStudentVerified,
                            String serviceTitle, String providerResponse,
                            Instant createdAt, boolean hidden) {

        public static ReviewDto of(Review r) {
            return new ReviewDto(r.getId(), r.getRating(), r.getBody(),
                    r.getAuthor().getName(), r.getAuthor().getAvatarSeed(),
                    r.getAuthor().isStudentVerified(),
                    r.getBooking().getService().getTitle(),
                    r.getProviderResponse(), r.getCreatedAt(), r.isHidden());
        }
    }

    /** Full provider profile page. */
    public record ProviderDetailDto(UUID id, String businessName, String tagline, String bio,
                                    String avatarSeed, boolean isVerified, boolean studentVerified,
                                    double ratingAvg, int ratingCount, int completedBookings,
                                    String locationLabel, List<LocationMode> locationModes,
                                    Double distanceMiles,
                                    String universityShortName, String universitySlug,
                                    UUID universityId, String status,
                                    boolean autoConfirmBookings, int minNoticeMinutes,
                                    int maxAdvanceDays, String cancellationPolicy,
                                    List<ServiceDto> services,
                                    List<PortfolioImageDto> portfolio,
                                    List<AvailabilityWindowDto> hours,
                                    List<ReviewDto> reviews,
                                    java.util.Map<Integer, Long> ratingDistribution,
                                    LocalDateTime nextAvailable,
                                    boolean favorited) {
    }

    public record SuggestionDto(List<CategorySuggestion> categories,
                                List<ProviderSuggestion> providers,
                                List<ServiceSuggestion> services) {

        public record CategorySuggestion(String name, String slug, String icon) {
        }

        public record ProviderSuggestion(UUID id, String businessName, double ratingAvg, String avatarSeed) {
        }

        public record ServiceSuggestion(UUID id, String title, int priceCents,
                                        UUID providerId, String providerName) {
        }
    }

    public record SearchResultDto(List<ProviderCardDto> cards, int total, int page,
                                  int perPage, int totalPages) {
    }
}
