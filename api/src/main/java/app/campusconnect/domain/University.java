package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A campus. The whole platform is multi-tenant along this axis: users pick one,
 * providers belong to one, and search defaults to it.
 *
 * Adding a university is pure data entry — no code change, no deploy — which is
 * what makes "scale from one campus to hundreds" a real claim.
 */
@Entity
@Table(name = "universities", indexes = {
        @Index(name = "idx_university_slug", columnList = "slug"),
        @Index(name = "idx_university_active", columnList = "active")
})
@Getter
@Setter
@NoArgsConstructor
public class University {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 40)
    private String shortName;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false, length = 40)
    private String state;

    /** Approximate campus centre, used for the distance shown on provider cards. */
    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    /** Brand colour for campus pages. */
    @Column(nullable = false, length = 20)
    private String color = "#4F46E5";

    @Column(nullable = false)
    private boolean active = true;

    /**
     * Universities do not share an email convention — utdallas.edu, mavs.uta.edu
     * and my.unt.edu are all "the student domain" somewhere. So the allowed
     * domains are data, never hardcoded.
     *
     * JPA gives us a real collection table here; the previous SQLite schema had
     * to fake this with a separate entity.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "university_email_domains",
            joinColumns = @JoinColumn(name = "university_id"),
            uniqueConstraints = @UniqueConstraint(columnNames = "domain")
    )
    @Column(name = "domain", nullable = false, length = 120)
    private Set<String> emailDomains = new LinkedHashSet<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public University(String name, String shortName, String slug, String city, String state,
                      double latitude, double longitude, String color, Set<String> emailDomains) {
        this.name = name;
        this.shortName = shortName;
        this.slug = slug;
        this.city = city;
        this.state = state;
        this.latitude = latitude;
        this.longitude = longitude;
        this.color = color;
        this.emailDomains = emailDomains;
    }
}
