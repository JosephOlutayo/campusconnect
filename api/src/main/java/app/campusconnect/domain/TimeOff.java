package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A one-off block that overrides the weekly rules — a holiday, a class, an exam
 * week. The slot engine treats these exactly like an existing booking.
 */
@Entity
@Table(name = "time_off", indexes = {
        @Index(name = "idx_timeoff_provider", columnList = "provider_id"),
        @Index(name = "idx_timeoff_window", columnList = "provider_id,startAt")
})
@Getter
@Setter
@NoArgsConstructor
public class TimeOff {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @Column(nullable = false)
    private LocalDateTime startAt;

    @Column(nullable = false)
    private LocalDateTime endAt;

    @Column(length = 200)
    private String reason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public TimeOff(ProviderProfile provider, LocalDateTime startAt, LocalDateTime endAt, String reason) {
        this.provider = provider;
        this.startAt = startAt;
        this.endAt = endAt;
        this.reason = reason;
    }
}
