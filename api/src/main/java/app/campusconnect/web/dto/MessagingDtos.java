package app.campusconnect.web.dto;

import app.campusconnect.domain.Conversation;
import app.campusconnect.domain.Message;
import app.campusconnect.domain.Notification;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class MessagingDtos {

    private MessagingDtos() {
    }

    public record OpenConversationRequest(
            @NotNull UUID providerId,
            @NotBlank @Size(max = 4000) String body) {
    }

    public record SendMessageRequest(
            @NotBlank(message = "Write a message.") @Size(max = 4000) String body,
            String imageSeed) {
    }

    public record MessageDto(UUID id, UUID conversationId, UUID senderId, String senderName,
                             String body, String imageSeed, Instant createdAt, Instant readAt) {

        public static MessageDto of(Message m) {
            return new MessageDto(m.getId(), m.getConversation().getId(), m.getSender().getId(),
                    m.getSender().getName(), m.getBody(), m.getImageSeed(),
                    m.getCreatedAt(), m.getReadAt());
        }
    }

    /** An inbox row, already resolved from the viewer's point of view. */
    public record ConversationDto(UUID id, UUID providerId, String counterpartName,
                                  String counterpartAvatarSeed, String lastMessage,
                                  Instant lastMessageAt, long unread, boolean viewerIsCustomer) {

        public static ConversationDto of(Conversation c, UUID viewerId, String lastMessage, long unread) {
            boolean isCustomer = c.getCustomer().getId().equals(viewerId);
            String name = isCustomer
                    ? c.getProvider().getBusinessName()
                    : c.getCustomer().getName();
            String seed = isCustomer
                    ? c.getProvider().getUser().getAvatarSeed()
                    : c.getCustomer().getAvatarSeed();
            return new ConversationDto(c.getId(), c.getProvider().getId(), name, seed,
                    lastMessage, c.getLastMessageAt(), unread, isCustomer);
        }
    }

    public record NotificationDto(UUID id, String type, String title, String body,
                                  String href, Instant readAt, Instant createdAt) {

        public static NotificationDto of(Notification n) {
            return new NotificationDto(n.getId(), n.getType().name(), n.getTitle(), n.getBody(),
                    n.getHref(), n.getReadAt(), n.getCreatedAt());
        }
    }
}
