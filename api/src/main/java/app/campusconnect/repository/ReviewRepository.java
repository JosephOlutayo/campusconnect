package app.campusconnect.repository;

import app.campusconnect.domain.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    Optional<Review> findByBookingId(UUID bookingId);

    boolean existsByBookingId(UUID bookingId);

    List<Review> findByProviderIdAndHiddenFalseOrderByCreatedAtDesc(UUID providerId);

    List<Review> findByAuthorIdOrderByCreatedAtDesc(UUID authorId);

    List<Review> findByProviderIdOrderByCreatedAtDesc(UUID providerId);

    /** Average and count over visible reviews only — the numbers shown publicly. */
    @Query("select coalesce(avg(r.rating), 0) from Review r where r.provider.id = :providerId and r.hidden = false")
    double averageVisibleRating(@Param("providerId") UUID providerId);

    long countByProviderIdAndHiddenFalse(UUID providerId);

    /** Star histogram across ALL visible reviews, not just a rendered page. */
    @Query("select r.rating, count(r) from Review r " +
           "where r.provider.id = :providerId and r.hidden = false group by r.rating")
    List<Object[]> ratingDistribution(@Param("providerId") UUID providerId);
}
