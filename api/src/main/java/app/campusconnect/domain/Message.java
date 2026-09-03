package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A single chat message. Persisted first, then broadcast over STOMP — so a
 * dropped socket costs you a live update, never the message itself.
 */
@Entity
@Table(name = "messages", indexes = {
        @Index(name = "idx_message_conversation", columnList = "conversation_id"),
        @Index(name = "idx_message_thread_order", columnList = "conversation_id,createdAt"),
        @Index(name = "idx_message_sender", columnList = "sender_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, length = 4000)
    private String body;

    /** Optional attached image, as a deterministic placeholder seed. */
    @Column(length = 80)
    private String imageSeed;

    /** Lets a message point at "your 5:30 Thursday cut". */
    @Column(name = "booking_id")
    private UUID bookingId;

    private Instant readAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Message(Conversation conversation, User sender, String body) {
        this.conversation = conversation;
        this.sender = sender;
        this.body = body;
    }
}
