package app.campusconnect.service;

import app.campusconnect.domain.Notification;
import app.campusconnect.domain.NotificationType;
import app.campusconnect.domain.User;
import app.campusconnect.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Single fan-out point for every user-facing alert.
 *
 * Today it writes the in-app row and nothing else. Email, SMS and push slot in
 * right here — dispatch per channel after the insert, keyed on the notification
 * id — and no caller has to change.
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @Transactional
    public void notify(User user, NotificationType type, String title, String body, String href) {
        notifications.save(new Notification(user, type, title, body, href));
        // dispatchEmail(...) / dispatchPush(...) go here once a provider exists.
    }

    @Transactional(readOnly = true)
    public List<Notification> recent(UUID userId) {
        return notifications.findTop50ByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notifications.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return notifications.markAllRead(userId, Instant.now());
    }
}
