package app.campusconnect.repository;

import app.campusconnect.domain.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    long countByConversationIdAndReadAtIsNullAndSenderIdNot(UUID conversationId, UUID senderId);

    /** Unread across every thread this account participates in. */
    @Query("""
            select count(m) from Message m
            where m.readAt is null and m.sender.id <> :userId
              and (m.conversation.customer.id = :userId or m.conversation.provider.user.id = :userId)
            """)
    long countUnreadForUser(@Param("userId") UUID userId);

    @Modifying
    @Query("update Message m set m.readAt = :now " +
           "where m.conversation.id = :conversationId and m.sender.id <> :userId and m.readAt is null")
    int markThreadRead(@Param("conversationId") UUID conversationId,
                       @Param("userId") UUID userId,
                       @Param("now") Instant now);
}
