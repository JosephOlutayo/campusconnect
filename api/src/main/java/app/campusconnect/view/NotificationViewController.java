package app.campusconnect.view;

import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.NotificationService;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

/**
 * What has happened on your account: booking requests, confirmations,
 * cancellations, messages and reviews.
 *
 * Opening the page does not mark anything read. A notification list that clears
 * itself the moment you glance at it loses the one thing it is for — being able
 * to come back and find what you have not dealt with.
 */
@Controller
public class NotificationViewController {

    private final NotificationService notifications;

    public NotificationViewController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping("/notifications")
    @Transactional(readOnly = true)
    public String list(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login?next=/notifications";
        }
        model.addAttribute("active", "notifications");
        model.addAttribute("items", notifications.recent(me.id()));
        model.addAttribute("unread", notifications.unreadCount(me.id()));
        return "notifications";
    }

    @PostMapping("/notifications/read")
    @Transactional
    public String markAllRead(@CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/notifications";
        }
        notifications.markAllRead(me.id());
        return "redirect:/notifications";
    }
}
