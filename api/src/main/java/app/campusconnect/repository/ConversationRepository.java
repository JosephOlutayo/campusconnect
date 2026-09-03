package app.campusconnect.repository;

import app.campusconnect.domain.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findByCustomerIdAndProviderId(UUID customerId, UUID providerId);

    /** Threads for either side of the account, newest activity first. */
    @Query("""
            select c from Conversation c
            where c.customer.id = :userId or c.provider.user.id = :userId
            order by c.lastMessageAt desc
            """)
    List<Conversation> findForUser(@Param("userId") UUID userId);
}
