package app.campusconnect.view;

import app.campusconnect.domain.User;
import app.campusconnect.repository.MessageRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * Puts the things every page needs into the model, so no controller has to
 * remember to.
 *
 * The layout draws its navigation from these: which links to show, whether to
 * offer "Sign in" or "Sign out", and the unread badge.
 */
@ControllerAdvice(basePackages = "app.campusconnect.view")
public class ViewModelAdvice {

    private final AuthService authService;
    private final MessageRepository messages;
    private final String appName;

    public ViewModelAdvice(AuthService authService,
                           MessageRepository messages,
                           @Value("${campusconnect.app-name:CampusConnect}") String appName) {
        this.authService = authService;
        this.messages = messages;
        this.appName = appName;
    }

    @ModelAttribute("appName")
    public String appName() {
        return appName;
    }

    /**
     * The signed-in user, or null for a visitor.
     *
     * Returning the entity rather than the token claims means templates can
     * reach the name and avatar without a second lookup on every page. The cost
     * is that the entity arrives at the template detached: open-in-view is off,
     * so rendering happens after the transaction has closed and any association
     * still lazy blows up mid-render — as a 500 no exception handler can catch,
     * because the response has already started.
     *
     * The campus is therefore loaded here, inside the transaction. Anything else
     * a template needs from this object has to be initialised here too.
     */
    @ModelAttribute("currentUser")
    @Transactional(readOnly = true)
    public User currentUser(@CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return null;
        }
        // A token can outlive the account it names — someone deleted mid-session
        // should read as signed out, not crash the page.
        try {
            User user = authService.require(me.id());
            if (user.getUniversity() != null) {
                user.getUniversity().getShortName();
            }
            return user;
        } catch (RuntimeException notFound) {
            return null;
        }
    }

    @ModelAttribute("unreadMessages")
    public long unreadMessages(@CurrentUser AuthenticatedUser me) {
        return me == null ? 0 : messages.countUnreadForUser(me.id());
    }
}
