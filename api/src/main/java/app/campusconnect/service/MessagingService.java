package app.campusconnect.service;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.web.ApiException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * In-app messaging.
 *
 * Persist first, then broadcast over STOMP. That order matters: if the socket is
 * down the message is still saved and shows up on the next fetch, whereas
 * broadcasting first would risk showing a message that never got stored.
 */
@Service
public class MessagingService {

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final ProviderProfileRepository providers;
    private final UserRepository users;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate broker;

    public MessagingService(ConversationRepository conversations,
                            MessageRepository messages,
                            ProviderProfileRepository providers,
                            UserRepository users,
                            NotificationService notificationService,
                            SimpMessagingTemplate broker) {
        this.conversations = conversations;
        this.messages = messages;
        this.providers = providers;
        this.users = users;
        this.notificationService = notificationService;
        this.broker = broker;
    }

    /** Loads a thread only if the requester is one of its two participants. */
    @Transactional(readOnly = true)
    public Conversation requireParticipant(UUID conversationId, UUID userId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("Conversation not found."));
        if (!conversation.includes(userId)) {
            // 404 rather than 403 — do not confirm the thread exists.
            throw ApiException.notFound("Conversation not found.");
        }
        return conversation;
    }

    /** Opens or reuses the thread between a student and a provider. */
    @Transactional
    public Conversation open(UUID customerId, UUID providerId, String firstMessage) {
        ProviderProfile provider = providers.findById(providerId)
                .orElseThrow(() -> ApiException.notFound("Provider not found."));
        if (provider.getUser().getId().equals(customerId)) {
            throw ApiException.badRequest("You cannot message yourself.");
        }
        User customer = users.findById(customerId)
                .orElseThrow(() -> ApiException.unauthorized("Sign in to message providers."));

        Conversation conversation = conversations
                .findByCustomerIdAndProviderId(customerId, providerId)
                .orElseGet(() -> conversations.save(new Conversation(customer, provider)));

        if (firstMessage != null && !firstMessage.isBlank()) {
            send(conversation.getId(), customerId, firstMessage, null);
        }
        return conversation;
    }

    @Transactional
    public Message send(UUID conversationId, UUID senderId, String body, String imageSeed) {
        Conversation conversation = requireParticipant(conversationId, senderId);
        User sender = users.findById(senderId)
                .orElseThrow(() -> ApiException.unauthorized("Sign in first."));

        Message message = new Message(conversation, sender, body.trim());
        message.setImageSeed(imageSeed);
        message = messages.save(message);

        conversation.setLastMessageAt(message.getCreatedAt());
        conversations.save(conversation);

        // Live push to anyone watching this thread.
        broker.convertAndSend("/topic/conversations/" + conversationId, Map.of(
                "id", message.getId().toString(),
                "conversationId", conversationId.toString(),
                "senderId", senderId.toString(),
                "senderName", sender.getName(),
                "body", message.getBody(),
                "createdAt", message.getCreatedAt().toString()));

        User recipient = conversation.getCustomer().getId().equals(senderId)
                ? conversation.getProvider().getUser()
                : conversation.getCustomer();

        notificationService.notify(recipient, NotificationType.MESSAGE_RECEIVED,
                "Message from " + sender.getName(),
                body.length() > 120 ? body.substring(0, 120) : body,
                "/messages/" + conversationId);

        return message;
    }

    @Transactional
    public List<Message> thread(UUID conversationId, UUID userId) {
        requireParticipant(conversationId, userId);
        List<Message> list = messages.findByConversationIdOrderByCreatedAtAsc(conversationId);
        messages.markThreadRead(conversationId, userId, Instant.now());
        return list;
    }

    @Transactional(readOnly = true)
    public List<Conversation> inbox(UUID userId) {
        return conversations.findForUser(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return messages.countUnreadForUser(userId);
    }

    @Transactional(readOnly = true)
    public long unreadInThread(UUID conversationId, UUID userId) {
        return messages.countByConversationIdAndReadAtIsNullAndSenderIdNot(conversationId, userId);
    }
}
