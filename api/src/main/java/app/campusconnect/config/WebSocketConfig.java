package app.campusconnect.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

/**
 * STOMP over WebSocket for live messaging.
 *
 * Topic layout: a client subscribes to /topic/conversations/{id}. The server
 * publishes there after a message is persisted, so delivery is at-most-once over
 * the socket while the database stays the source of truth — a dropped socket
 * costs a live update, never a message.
 *
 * Authorisation is NOT done at subscribe time here; it is enforced on the send
 * path (MessageService checks participation before persisting) and on the REST
 * fetch. Locking down subscriptions needs a ChannelInterceptor on the CONNECT
 * frame — noted in the README as unfinished rather than pretended-complete.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String corsOrigins;

    public WebSocketConfig(@Value("${campusconnect.cors-origins}") String corsOrigins) {
        this.corsOrigins = corsOrigins;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker: fine for one instance. Multiple instances need
        // RabbitMQ or Redis behind enableStompBrokerRelay.
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = Arrays.stream(corsOrigins.split(",")).map(String::trim).toArray(String[]::new);
        registry.addEndpoint("/ws")
                .setAllowedOrigins(origins)
                .withSockJS();
    }
}
