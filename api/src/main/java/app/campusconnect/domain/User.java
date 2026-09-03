package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * An account. One row covers students, providers and admins — a provider is a
 * User with a {@link ProviderProfile} attached, which is what lets a provider
 * book someone else's haircut without a second account.
 *
 * Table is "users" because USER is a reserved word in Postgres and H2.
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_user_email", columnList = "email"),
        @Index(name = "idx_user_university", columnList = "university_id"),
        @Index(name = "idx_user_role", columnList = "role")
})
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 190)
    private String email;

    /** BCrypt hash. Never exposed by any DTO. */
    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.STUDENT;

    /** Drives the deterministic gradient avatar on the client. */
    @Column(nullable = false, length = 80)
    private String avatarSeed;

    @Column(length = 600)
    private String bio;

    @Column(length = 40)
    private String phone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "university_id")
    private University university;

    /** Plain address ownership. */
    private Instant emailVerifiedAt;

    /** Set only once a .edu address on the chosen campus is confirmed. */
    private Instant studentVerifiedAt;

    @Column(nullable = false)
    private boolean suspended = false;

    @Column(length = 400)
    private String suspendedNote;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToOne(mappedBy = "user", fetch = FetchType.LAZY)
    private ProviderProfile providerProfile;

    public User(String email, String passwordHash, String name, Role role,
                String avatarSeed, University university) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
        this.role = role;
        this.avatarSeed = avatarSeed;
        this.university = university;
    }

    public boolean isStudentVerified() {
        return studentVerifiedAt != null;
    }
}
