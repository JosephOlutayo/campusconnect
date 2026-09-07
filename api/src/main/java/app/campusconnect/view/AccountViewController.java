package app.campusconnect.view;

import app.campusconnect.domain.Conversation;
import app.campusconnect.domain.Favorite;
import app.campusconnect.domain.Message;
import app.campusconnect.repository.FavoriteRepository;
import app.campusconnect.repository.ProviderProfileRepository;
import app.campusconnect.repository.UserRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.MessagingService;
import app.campusconnect.service.SearchService;
import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Saved providers and messages — the pages that belong to one signed-in person.
 *
 * Messaging here is server-rendered rather than live. The React version kept a
 * STOMP socket open and appended messages as they arrived; this version reloads
 * the thread on send. That is a real reduction: you see the other person's
 * reply when the page next loads rather than the moment it is sent. The broker
 * is still wired up on the server, so a live client can be added back later
 * without touching how messages are stored.
 */
@Controller
public class AccountViewController {

    private final MessagingService messaging;
    private final FavoriteRepository favorites;
    private final ProviderProfileRepository providers;
    private final UserRepository users;
    private final SearchService search;

    public AccountViewController(MessagingService messaging,
                                 FavoriteRepository favorites,
                                 ProviderProfileRepository providers,
                                 UserRepository users,
                                 SearchService search) {
        this.messaging = messaging;
        this.favorites = favorites;
        this.providers = providers;
        this.users = users;
        this.search = search;
    }

    // --- saved providers -----------------------------------------------------

    @GetMapping("/favorites")
    @Transactional(readOnly = true)
    public String saved(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login?next=/favorites";
        }
        List<UUID> providerIds = favorites.findByUserIdOrderByCreatedAtDesc(me.id()).stream()
                .map(favorite -> favorite.getProvider().getId())
                .toList();

        model.addAttribute("active", "favorites");
        // The same card builder search uses, so a saved provider looks exactly
        // like it does everywhere else — and stays ordered newest-saved first.
        model.addAttribute("cards", search.cardsForProviders(providerIds));
        return "favorites";
    }

    @PostMapping("/favorites/{providerId}")
    @Transactional
    public String toggleSaved(@PathVariable UUID providerId,
                              @RequestParam(required = false) String back,
                              @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/providers/" + providerId;
        }
        if (favorites.existsByUserIdAndProviderId(me.id(), providerId)) {
            favorites.deleteByUserIdAndProviderId(me.id(), providerId);
        } else {
            var provider = providers.findById(providerId)
                    .orElseThrow(() -> ApiException.notFound("Provider not found."));
            var user = users.findById(me.id())
                    .orElseThrow(() -> ApiException.unauthorized("Sign in first."));
            favorites.save(new Favorite(user, provider));
        }
        return "redirect:" + (isInApp(back) ? back : "/providers/" + providerId);
    }

    // --- messages ------------------------------------------------------------

    @GetMapping("/messages")
    @Transactional(readOnly = true)
    public String inbox(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login?next=/messages";
        }
        // open-in-view is off, so both sides of every thread are read here,
        // while the transaction is still open, rather than from the template.
        List<InboxRow> rows = messaging.inbox(me.id()).stream()
                .map(thread -> new InboxRow(
                        thread.getId(),
                        thread.getCustomer().getId().equals(me.id())
                                ? thread.getProvider().getBusinessName()
                                : thread.getCustomer().getName(),
                        local(thread.getLastMessageAt()),
                        messaging.unreadInThread(thread.getId(), me.id())))
                .toList();

        model.addAttribute("active", "messages");
        model.addAttribute("threads", rows);
        return "messages";
    }

    @GetMapping("/messages/{id}")
    @Transactional
    public String thread(@PathVariable UUID id,
                         @RequestParam(required = false) String error,
                         @CurrentUser AuthenticatedUser me,
                         Model model) {
        if (me == null) {
            return "redirect:/login?next=/messages/" + id;
        }
        // requireParticipant is the authorisation check, and it answers 404 so
        // that guessing ids cannot confirm a thread exists.
        Conversation conversation = messaging.requireParticipant(id, me.id());
        boolean viewerIsCustomer = conversation.getCustomer().getId().equals(me.id());

        // thread() also marks the messages read, which is why this is not a
        // read-only transaction.
        List<Message> thread = messaging.thread(id, me.id());
        List<Bubble> bubbles = thread.stream()
                .map(message -> new Bubble(
                        message.getBody(),
                        local(message.getCreatedAt()),
                        message.getSender().getId().equals(me.id()),
                        message.getSender().getName()))
                .toList();

        model.addAttribute("active", "messages");
        model.addAttribute("conversationId", id);
        model.addAttribute("counterpart", viewerIsCustomer
                ? conversation.getProvider().getBusinessName()
                : conversation.getCustomer().getName());
        model.addAttribute("providerId", conversation.getProvider().getId());
        model.addAttribute("viewerIsCustomer", viewerIsCustomer);
        model.addAttribute("messages", bubbles);
        model.addAttribute("error", error);
        return "thread";
    }

    @PostMapping("/messages/{id}")
    public String send(@PathVariable UUID id,
                       @RequestParam String body,
                       @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/messages/" + id;
        }
        if (body == null || body.isBlank()) {
            return "redirect:/messages/" + id;
        }
        try {
            messaging.send(id, me.id(), body, null);
            return "redirect:/messages/" + id;
        } catch (ApiException refused) {
            // STATELESS means flash attributes are dropped, so a refusal has to
            // survive the redirect in the URL.
            return "redirect:/messages/" + id + "?error="
                    + URLEncoder.encode(refused.getMessage(), StandardCharsets.UTF_8);
        }
    }

    /** "Message" on a provider page: opens the thread, or reuses the existing one. */
    @PostMapping("/providers/{providerId}/message")
    public String startThread(@PathVariable UUID providerId,
                              @RequestParam(required = false) String body,
                              @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login?next=/providers/" + providerId;
        }
        try {
            Conversation conversation = messaging.open(me.id(), providerId, body);
            return "redirect:/messages/" + conversation.getId();
        } catch (ApiException refused) {
            return "redirect:/providers/" + providerId + "?error="
                    + URLEncoder.encode(refused.getMessage(), StandardCharsets.UTF_8);
        }
    }

    // --- helpers -------------------------------------------------------------

    /** Only ever an in-app path — see the note on AuthViewController.safeNext. */
    private boolean isInApp(String path) {
        return path != null && path.startsWith("/") && !path.startsWith("//");
    }

    /**
     * Instants are stored in UTC; templates format dates and times, which an
     * Instant cannot supply on its own. Zoning happens once, here.
     */
    private static LocalDateTime local(java.time.Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }

    public record InboxRow(UUID id, String counterpart, LocalDateTime lastMessageAt, long unread) {
    }

    public record Bubble(String body, LocalDateTime sentAt, boolean mine, String senderName) {
    }
}
