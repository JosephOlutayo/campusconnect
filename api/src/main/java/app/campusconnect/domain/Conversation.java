package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One thread between a student and a provider. The unique constraint means
 * "message this provider" is an upsert — you never end up with three parallel
 * threads with the same person.
 */
@Entity
@Table(
        name = "conversations",
        uniqueConstraints = @UniqueConstraint(name = "uq_conversation_pair",
                columnNames = {"customer_id", "provider_id"}),
        indexes = {
                @Index(name = "idx_conversation_customer", columnList = "customer_id"),
                @Index(name = "idx_conversation_provider", columnList = "provider_id"),
                @Index(name = "idx_conversation_recent", columnList = "lastMessageAt")
        })
@Getter
@Setter
@NoArgsConstructor
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderProfile provider;

    @Column(nullable = false)
    private Instant lastMessageAt = Instant.now();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Message> messages = new ArrayList<>();

    public Conversation(User customer, ProviderProfile provider) {
        this.customer = customer;
        this.provider = provider;
    }

    /** True if this account is one of the two participants. */
    public boolean includes(UUID userId) {
        return customer.getId().equals(userId) || provider.getUser().getId().equals(userId);
    }
}
