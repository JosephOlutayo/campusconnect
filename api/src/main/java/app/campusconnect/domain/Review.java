package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A review is earned, not posted.
 *
 * The one-to-one on booking is the structural guarantee: a review cannot exist
 * without a booking, the unique constraint stops a second review on the same
 * booking, and the service layer additionally requires that booking to be
 * COMPLETED and owned by the author.
 */
@Entity
@Table(name = "reviews", indexes = {
        @Index(name = "idx_review_provider", columnList = "provider_id"),
        @Index(name = "idx_review_author", columnList = "author_id"),
        @Index(name = "idx_review_visible", columnList = "provider_id,hidden")
})
@Getter
@Setter
@NoArgsConstructor
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    /** 1..5, validated at the API boundary and again in the service. */
    @Column(nullable = false)
    private int rating;

    @Column(nullable = false, length = 2000)
    private String body;

    @Column(length = 1200)
    private String providerResponse;

    private Instant providerRespondedAt;

    /** Hidden by moderation. Hidden reviews are excluded from the rating average. */
    @Column(nullable = false)
    private boolean hidden = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Review(Booking booking, ProviderProfile provider, User author, int rating, String body) {
        this.booking = booking;
        this.provider = provider;
        this.author = author;
        this.rating = rating;
        this.body = body;
    }
}
