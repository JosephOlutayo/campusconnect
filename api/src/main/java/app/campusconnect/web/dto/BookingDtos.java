package app.campusconnect.web.dto;

import app.campusconnect.domain.Booking;
import app.campusconnect.domain.LocationMode;
import app.campusconnect.domain.Payment;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

public final class BookingDtos {

    private BookingDtos() {
    }

    public record CreateBookingRequest(
            @NotNull(message = "Pick a service.") UUID serviceId,
            @NotNull(message = "Pick a time.") LocalDateTime startAt,
            @NotNull(message = "Pick where it happens.") LocationMode locationMode,
            @Size(max = 600) String customerNote,
            @Size(max = 250) String customerLocationHint,
            @Size(max = 30) String promoCode) {
    }

    public record RescheduleRequest(@NotNull LocalDateTime startAt) {
    }

    public record BookingActionRequest(
            @NotBlank String action,
            @Size(max = 400) String reason,
            LocalDateTime startAt) {
    }

    public record PaymentDto(int amountCents, int platformFeeCents, int providerAmountCents,
                             String status, String gateway) {

        public static PaymentDto of(Payment payment) {
            if (payment == null) {
                return null;
            }
            return new PaymentDto(payment.getAmountCents(), payment.getPlatformFeeCents(),
                    payment.getProviderAmountCents(), payment.getStatus().name(), payment.getGateway());
        }
    }

    /**
     * One booking, as seen by a participant.
     *
     * {@code exactAddress} is populated only when the viewer is the customer AND
     * the booking is confirmed — the privacy rule lives in the mapper below, so
     * no controller can forget it.
     */
    public record BookingDto(UUID id, String code, String status,
                             LocalDateTime startAt, LocalDateTime endAt,
                             int priceCents, int platformFeeCents, int providerPayoutCents,
                             String locationMode, String locationLabel, String exactAddress,
                             String customerNote, String cancellationReason,
                             UUID serviceId, String serviceTitle, int durationMinutes,
                             UUID providerId, String providerName, String providerAvatarSeed,
                             double providerRating, int providerRatingCount,
                             String cancellationPolicy,
                             UUID customerId, String customerName, String customerAvatarSeed,
                             PaymentDto payment, boolean reviewed, Integer reviewRating,
                             Instant createdAt) {

        public static BookingDto of(Booking b, UUID viewerId, boolean reviewed, Integer reviewRating) {
            boolean isCustomer = b.getCustomer().getId().equals(viewerId);
            String address = (isCustomer && b.addressUnlocked())
                    ? b.getProvider().getExactAddress()
                    : null;

            return new BookingDto(
                    b.getId(), b.getCode(), b.getStatus().name(),
                    b.getStartAt(), b.getEndAt(),
                    b.getPriceCents(), b.getPlatformFeeCents(), b.getProviderPayoutCents(),
                    b.getLocationMode().name(), b.getLocationLabel(), address,
                    b.getCustomerNote(), b.getCancellationReason(),
                    b.getService().getId(), b.getService().getTitle(),
                    b.getService().getDurationMinutes(),
                    b.getProvider().getId(), b.getProvider().getBusinessName(),
                    b.getProvider().getUser().getAvatarSeed(),
                    b.getProvider().getRatingAvg(), b.getProvider().getRatingCount(),
                    b.getProvider().getCancellationPolicy(),
                    b.getCustomer().getId(), b.getCustomer().getName(),
                    b.getCustomer().getAvatarSeed(),
                    PaymentDto.of(b.getPayment()), reviewed, reviewRating,
                    b.getCreatedAt());
        }
    }

    public record SlotDto(LocalDateTime startAt, LocalDateTime endAt) {
    }

    public record CreateReviewRequest(
            @NotNull UUID bookingId,
            @Min(value = 1, message = "Pick a rating.")
            @Max(value = 5, message = "Pick a rating.") int rating,
            @NotBlank(message = "Say a little about your experience.")
            @Size(min = 5, max = 2000) String body) {
    }

    public record ReviewResponseRequest(
            @NotBlank @Size(min = 2, max = 1200) String response) {
    }
}
