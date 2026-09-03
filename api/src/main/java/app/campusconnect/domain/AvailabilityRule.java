package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.DayOfWeek;
import java.util.UUID;

/**
 * One recurring weekly working window, stored as minutes from local midnight.
 *
 * Several rows on the same weekday model split shifts (09:00-12:00, 14:00-18:00),
 * which is also how a lunch break is expressed — there is no separate "break"
 * concept to keep in sync.
 */
@Entity
@Table(name = "availability_rules", indexes = {
        @Index(name = "idx_availability_provider", columnList = "provider_id"),
        @Index(name = "idx_availability_provider_day", columnList = "provider_id,dayOfWeek")
})
@Getter
@Setter
@NoArgsConstructor
public class AvailabilityRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private DayOfWeek dayOfWeek;

    /** Minutes from local midnight, e.g. 600 = 10:00. */
    @Column(nullable = false)
    private int startMinute;

    @Column(nullable = false)
    private int endMinute;

    public AvailabilityRule(ProviderProfile provider, DayOfWeek dayOfWeek, int startMinute, int endMinute) {
        this.provider = provider;
        this.dayOfWeek = dayOfWeek;
        this.startMinute = startMinute;
        this.endMinute = endMinute;
    }
}
