package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A service category. {@code keywords} is what makes fuzzy search work —
 * "braids" finds Braiding, "math tutor" finds Tutoring — without hardcoding
 * synonyms in the search code.
 */
@Entity
@Table(name = "categories", indexes = @Index(name = "idx_category_slug", columnList = "slug"))
@Getter
@Setter
@NoArgsConstructor
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    /** Emoji — keeps icon art out of the bundle. */
    @Column(nullable = false, length = 12)
    private String icon;

    @Column(nullable = false, length = 300)
    private String description;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "category_keywords", joinColumns = @JoinColumn(name = "category_id"))
    @Column(name = "keyword", nullable = false, length = 60)
    private Set<String> keywords = new LinkedHashSet<>();

    @Column(nullable = false, length = 20)
    private String color = "#4F46E5";

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;

    public Category(String name, String slug, String icon, String description,
                    Set<String> keywords, String color, int sortOrder) {
        this.name = name;
        this.slug = slug;
        this.icon = icon;
        this.description = description;
        this.keywords = keywords;
        this.color = color;
        this.sortOrder = sortOrder;
    }
}
