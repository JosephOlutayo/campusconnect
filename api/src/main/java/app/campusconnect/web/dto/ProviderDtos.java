package app.campusconnect.web.dto;

import app.campusconnect.domain.LocationMode;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Requests a provider makes about their own business. */
public final class ProviderDtos {

    private ProviderDtos() {
    }

    public record OnboardingRequest(
            @NotBlank(message = "Give your business a name.") @Size(min = 2, max = 120) String businessName,
            @Size(max = 160) String tagline,
            @NotBlank(message = "Write a sentence or two about your work.")
            @Size(min = 20, max = 4000) String bio,
            @NotBlank(message = "Where do you work from?") @Size(min = 3, max = 160) String locationLabel,
            @Size(max = 250) String exactAddress,
            @NotEmpty(message = "Pick at least one location option.") List<LocationMode> locationModes,
            @NotNull(message = "Pick your main category.") UUID categoryId,
            @NotBlank(message = "Name your first service.") @Size(max = 140) String serviceTitle,
            @NotBlank(message = "Describe the service.") @Size(min = 10, max = 2000) String serviceDescription,
            @Min(1) @Max(500000) int priceCents,
            @Min(10) @Max(600) int durationMinutes) {
    }

    public record BusinessSettingsRequest(
            @NotBlank @Size(min = 2, max = 120) String businessName,
            @Size(max = 160) String tagline,
            @NotBlank @Size(min = 10, max = 4000) String bio,
            @NotBlank @Size(min = 3, max = 160) String locationLabel,
            @Size(max = 250) String exactAddress,
            @NotEmpty List<LocationMode> locationModes,
            boolean autoConfirmBookings,
            @Min(0) @Max(240) int bufferMinutes,
            @Min(0) @Max(10080) int minNoticeMinutes,
            @Min(1) @Max(365) int maxAdvanceDays,
            @NotBlank @Size(min = 5, max = 600) String cancellationPolicy,
            /** ACTIVE or PAUSED — a provider cannot promote themselves out of moderation. */
            @NotBlank String status) {
    }

    public record ServiceRequest(
            @NotBlank @Size(min = 2, max = 140) String title,
            @NotBlank @Size(min = 10, max = 2000) String description,
            @NotNull UUID categoryId,
            @Min(1) @Max(500000) int priceCents,
            @Min(10) @Max(600) int durationMinutes,
            List<LocationMode> locationModes,
            Boolean active) {
    }

    public record AvailabilityWindow(
            @NotBlank String dayOfWeek,
            @Min(0) @Max(1440) int startMinute,
            @Min(0) @Max(1440) int endMinute) {
    }

    /** The whole week is sent at once and replaces what was there. */
    public record AvailabilityRequest(@NotNull List<AvailabilityWindow> windows) {
    }

    public record TimeOffRequest(
            @NotNull LocalDateTime startAt,
            @NotNull LocalDateTime endAt,
            @Size(max = 200) String reason) {
    }

    public record PromotionRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9]{3,20}$", message = "Letters and numbers only.")
            String code,
            @NotBlank @Size(max = 200) String description,
            @NotBlank String discountType,
            @Min(1) int discountValue,
            @NotNull LocalDateTime startsAt,
            @NotNull LocalDateTime endsAt,
            Integer maxRedemptions) {
    }

    /** Provider dashboard headline numbers. */
    public record ProviderStatsDto(long pendingRequests, long upcoming, long completedAllTime,
                                   long earnedAllTimeCents, long earnedThisMonthCents,
                                   double ratingAvg, int ratingCount,
                                   List<WeekBucket> earningsByWeek) {

        public record WeekBucket(String label, long amountCents, long bookings) {
        }
    }

    public record ReportRequest(
            @NotBlank String targetType,
            @NotNull UUID targetId,
            @NotBlank @Size(max = 120) String reason,
            @Size(max = 2000) String details) {
    }
}
