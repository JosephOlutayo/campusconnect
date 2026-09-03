package app.campusconnect.web;

import app.campusconnect.domain.Conversation;
import app.campusconnect.domain.Message;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.MessagingService;
import app.campusconnect.web.dto.MessagingDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/conversations")
public class MessageController {

    private final MessagingService messagingService;

    public MessageController(MessagingService messagingService) {
        this.messagingService = messagingService;
    }

    @GetMapping
    public ApiResponse<List<ConversationDto>> inbox(@CurrentUser AuthenticatedUser me) {
        List<ConversationDto> rows = messagingService.inbox(me.id()).stream()
                .map(conversation -> {
                    List<Message> messages = conversation.getMessages();
                    String last = messages.isEmpty()
                            ? ""
                            : messages.get(messages.size() - 1).getBody();
                    return ConversationDto.of(conversation, me.id(), last,
                            messagingService.unreadInThread(conversation.getId(), me.id()));
                })
                .toList();
        return ApiResponse.ok(rows);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, String>>> open(
            @CurrentUser AuthenticatedUser me,
            @Valid @RequestBody OpenConversationRequest request) {
        Conversation conversation = messagingService.open(me.id(), request.providerId(), request.body());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(Map.of("id", conversation.getId().toString())));
    }

    @GetMapping("/{id}/messages")
    @Transactional
    public ApiResponse<Map<String, Object>> thread(@CurrentUser AuthenticatedUser me,
                                                   @PathVariable UUID id) {
        List<MessageDto> messages = messagingService.thread(id, me.id()).stream()
                .map(MessageDto::of).toList();
        return ApiResponse.ok(Map.of("messages", messages, "viewerId", me.id().toString()));
    }

    @PostMapping("/{id}/messages")
    @Transactional
    public ResponseEntity<ApiResponse<MessageDto>> send(@CurrentUser AuthenticatedUser me,
                                                        @PathVariable UUID id,
                                                        @Valid @RequestBody SendMessageRequest request) {
        Message message = messagingService.send(id, me.id(), request.body(), request.imageSeed());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(MessageDto.of(message)));
    }

    /**
     * STOMP entry point: clients SEND to /app/conversations/{id}/send and the
     * service broadcasts to /topic/conversations/{id}.
     *
     * The REST endpoint above remains the reliable path — this is the low-latency
     * one. Both funnel through the same service method, so participation checks
     * and persistence cannot diverge between transports.
     */
    @MessageMapping("/conversations/{id}/send")
    public void sendOverSocket(@DestinationVariable UUID id,
                               SendMessageRequest request,
                               java.security.Principal principal) {
        if (principal == null) {
            return;
        }
        UUID senderId = UUID.fromString(principal.getName());
        messagingService.send(id, senderId, request.body(), request.imageSeed());
    }
}
