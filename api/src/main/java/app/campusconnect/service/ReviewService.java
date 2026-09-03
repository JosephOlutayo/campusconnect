package app.campusconnect.service;

import app.campusconnect.domain.*;
import app.campusconnect.repository.BookingRepository;
import app.campusconnect.repository.ProviderProfileRepository;
import app.campusconnect.repository.ReviewRepository;
import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReviewService {

    private final ReviewRepository reviews;
    private final BookingRepository bookings;
    private final ProviderProfileRepository providers;
    private final NotificationService notificationService;

    public ReviewService(ReviewRepository reviews, BookingRepository bookings,
                         ProviderProfileRepository providers, NotificationService notificationService) {
        this.reviews = reviews;
        this.bookings = bookings;
        this.providers = providers;
        this.notificationService = notificationService;
    }

    /**
     * A review is earned, not posted. The only way in is a COMPLETED booking
     * that belongs to the author and has not been reviewed — enforced here and
     * again by the unique constraint on Review.booking.
     */
    @Transactional
    public Review create(UUID bookingId, UUID authorId, int rating, String body) {
        Booking booking = bookings.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Booking not found."));

        if (!booking.getCustomer().getId().equals(authorId)) {
            throw ApiException.forbidden("You can only review your own appointments.");
        }
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw ApiException.badRequest("You can review a provider once your appointment is completed.");
        }
        if (reviews.existsByBookingId(bookingId)) {
            throw ApiException.badRequest("You already reviewed this appointment.");
        }
        if (rating < 1 || rating > 5) {
            throw ApiException.badRequest("Rating must be 1 to 5 stars.");
        }

        Review review = reviews.save(new Review(
                booking, booking.getProvider(), booking.getCustomer(), rating, body.trim()));

        recomputeRating(booking.getProvider().getId());

        notificationService.notify(booking.getProvider().getUser(), NotificationType.REVIEW_RECEIVED,
                rating + "-star review",
                booking.getCustomer().getName() + " reviewed your work.",
                "/provider/reviews");

        return review;
    }

    @Transactional
    public Review respond(UUID reviewId, UUID providerUserId, String response) {
        Review review = reviews.findById(reviewId)
                .orElseThrow(() -> ApiException.notFound("Review not found."));
        if (!review.getProvider().getUser().getId().equals(providerUserId)) {
            throw ApiException.forbidden("Not allowed.");
        }
        review.setProviderResponse(response.trim());
        review.setProviderRespondedAt(Instant.now());

        notificationService.notify(review.getAuthor(), NotificationType.REVIEW_REPLY,
                "Provider replied",
                review.getProvider().getBusinessName() + " responded to your review.",
                "/providers/" + review.getProvider().getId());

        return reviews.save(review);
    }

    @Transactional
    public void setHidden(UUID reviewId, boolean hidden) {
        Review review = reviews.findById(reviewId)
                .orElseThrow(() -> ApiException.notFound("Review not found."));
        review.setHidden(hidden);
        reviews.save(review);
        // Hiding a review must move the public average with it.
        recomputeRating(review.getProvider().getId());
    }

    /**
     * Recomputes the denormalised rating columns from visible reviews. Called
     * after every write that can change them, so ratingAvg is always derivable
     * rather than slowly drifting from reality.
     */
    @Transactional
    public void recomputeRating(UUID providerId) {
        ProviderProfile provider = providers.findById(providerId)
                .orElseThrow(() -> ApiException.notFound("Provider not found."));
        double average = reviews.averageVisibleRating(providerId);
        long count = reviews.countByProviderIdAndHiddenFalse(providerId);

        provider.setRatingAvg(Math.round(average * 100.0) / 100.0);
        provider.setRatingCount((int) count);
        providers.save(provider);
    }

    /** Star histogram over ALL visible reviews, not just a rendered page. */
    @Transactional(readOnly = true)
    public Map<Integer, Long> distribution(UUID providerId) {
        Map<Integer, Long> result = new HashMap<>();
        for (int star = 1; star <= 5; star++) {
            result.put(star, 0L);
        }
        for (Object[] row : reviews.ratingDistribution(providerId)) {
            result.put((Integer) row[0], (Long) row[1]);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Review> forProvider(UUID providerId) {
        return reviews.findByProviderIdAndHiddenFalseOrderByCreatedAtDesc(providerId);
    }

    @Transactional(readOnly = true)
    public List<Review> byAuthor(UUID authorId) {
        return reviews.findByAuthorIdOrderByCreatedAtDesc(authorId);
    }

    /** Completed bookings the student can still review. */
    @Transactional(readOnly = true)
    public List<Booking> awaitingReview(UUID customerId) {
        return bookings.findHistoryForCustomer(customerId, List.of(BookingStatus.COMPLETED),
                        java.time.LocalDateTime.now()).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.COMPLETED)
                .filter(booking -> !reviews.existsByBookingId(booking.getId()))
                .toList();
    }
}
