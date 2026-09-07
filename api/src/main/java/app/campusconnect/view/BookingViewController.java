package app.campusconnect.view;

import app.campusconnect.domain.Booking;
import app.campusconnect.domain.LocationMode;
import app.campusconnect.domain.ProviderProfile;
import app.campusconnect.domain.ProviderStatus;
import app.campusconnect.domain.ServiceOffering;
import app.campusconnect.repository.ProviderProfileRepository;
import app.campusconnect.repository.ReviewRepository;
import app.campusconnect.repository.ServiceOfferingRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.AvailabilityService;
import app.campusconnect.service.BookingService;
import app.campusconnect.service.Slot;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A provider's public page, and the booking it leads to.
 *
 * The slot picker is a plain form: choosing a service or a date reloads the
 * page with those in the query string. That keeps a half-made booking
 * shareable and survivable — the back button works, and a refresh does not lose
 * the choice — where a client-side widget would hold it all in memory.
 */
@Controller
public class BookingViewController {

    /** How far ahead the date strip runs. Two weeks is enough to choose from. */
    private static final int DAYS_SHOWN = 14;

    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final ReviewRepository reviews;
    private final AvailabilityService availability;
    private final BookingService bookings;

    public BookingViewController(ProviderProfileRepository providers,
                                 ServiceOfferingRepository services,
                                 ReviewRepository reviews,
                                 AvailabilityService availability,
                                 BookingService bookings) {
        this.providers = providers;
        this.services = services;
        this.reviews = reviews;
        this.availability = availability;
        this.bookings = bookings;
    }

    @GetMapping("/providers/{id}")
    @Transactional(readOnly = true)
    public String provider(@PathVariable UUID id,
                           @RequestParam(required = false) UUID service,
                           @RequestParam(required = false) String date,
                           @RequestParam(required = false) String error,
                           @CurrentUser AuthenticatedUser me,
                           Model model) {

        ProviderProfile provider = providers.findById(id)
                .orElseThrow(() -> ApiException.notFound("Provider not found."));

        boolean isOwner = me != null && provider.getUser().getId().equals(me.id());
        boolean isAdmin = me != null && me.isAdmin();
        // A paused or unapproved listing is visible only to its owner and admins.
        if (provider.getStatus() != ProviderStatus.ACTIVE && !isOwner && !isAdmin) {
            throw ApiException.notFound("Provider not found.");
        }

        List<ServiceOffering> offerings =
                services.findByProviderIdAndActiveTrueOrderByPriceCentsAsc(id);

        ServiceOffering chosen = offerings.stream()
                .filter(s -> service == null || s.getId().equals(service))
                .findFirst()
                .orElse(offerings.isEmpty() ? null : offerings.get(0));

        LocalDate chosenDay = parseDayOrToday(date);

        /*
         * Rendering happens after this method returns, by which point the
         * transaction is closed — and open-in-view is off. Any association the
         * template touches must therefore be loaded here, or Thymeleaf fails
         * mid-page with a lazy-initialisation error that reads as a template
         * bug rather than a fetching one.
         */
        if (provider.getUniversity() != null) {
            provider.getUniversity().getShortName();
        }
        provider.getLocationModes().size();
        provider.getUser().getName();

        model.addAttribute("active", "explore");
        model.addAttribute("bookingError", error);
        model.addAttribute("provider", provider);
        model.addAttribute("services", offerings);
        model.addAttribute("chosenService", chosen);
        model.addAttribute("chosenDay", chosenDay);
        model.addAttribute("days", nextDays(chosenDay));
        // Hidden reviews are moderated out; the public page must not show them.
        var visibleReviews = reviews.findByProviderIdAndHiddenFalseOrderByCreatedAtDesc(id);
        visibleReviews.forEach(review -> {
            if (review.getAuthor() != null) {
                review.getAuthor().getName();
            }
        });
        model.addAttribute("reviews", visibleReviews);
        model.addAttribute("isOwner", isOwner);

        if (chosen != null) {
            // Each service carries its own location options, falling back to the
            // provider's. Resolved here so the template does not have to know
            // the rule, and loaded before the transaction closes.
            model.addAttribute("locationModes", List.copyOf(chosen.effectiveLocationModes()));
            model.addAttribute("slots", availability.slotsForDay(chosen.getId(), chosenDay, null));
        } else {
            model.addAttribute("locationModes", List.of());
            model.addAttribute("slots", List.<Slot>of());
        }
        return "provider";
    }

    /**
     * Takes the booking.
     *
     * Not @Transactional: BookingService.create runs at REQUIRES_NEW and
     * SERIALIZABLE on purpose, to hold a row lock for the overlap check. An
     * outer transaction here would both fight that and, when the service
     * rejects a clashing slot, mark this one rollback-only — turning "that time
     * was just booked" into a 500.
     */
    @PostMapping("/providers/{id}/book")
    public String book(@PathVariable UUID id,
                       @RequestParam UUID serviceId,
                       @RequestParam String startAt,
                       @RequestParam(required = false) String locationMode,
                       @RequestParam(required = false) String note,
                       @CurrentUser AuthenticatedUser me) {

        if (me == null) {
            // Send them to sign in, then back to the page they were booking on.
            return "redirect:/login?next=/providers/" + id;
        }

        try {
            Booking booking = bookings.create(
                    me.id(),
                    serviceId,
                    LocalDateTime.parse(startAt),
                    locationMode == null || locationMode.isBlank()
                            ? null : LocationMode.valueOf(locationMode),
                    note,
                    null,
                    null);
            return "redirect:/appointments/" + booking.getId();
        } catch (ApiException rejected) {
            /*
             * The common case is a slot taken between the page rendering and
             * the button being pressed. Say so on the page they came from, with
             * the day still selected so the next choice is one click away.
             *
             * The message travels as a query parameter rather than a flash
             * attribute: flash storage needs a session, and this application is
             * STATELESS so it can carry a JWT. A flash attribute here is
             * discarded silently — the booking fails and the page explains
             * nothing.
             */
            return "redirect:/providers/" + id
                    + "?service=" + serviceId
                    + "&date=" + LocalDateTime.parse(startAt).toLocalDate()
                    + "&error=" + URLEncoder.encode(rejected.getMessage(), StandardCharsets.UTF_8);
        }
    }

    // --- helpers -------------------------------------------------------------

    private LocalDate parseDayOrToday(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDate.now();
        }
        try {
            LocalDate parsed = LocalDate.parse(raw);
            // A date in the past has no bookable slots; treat a stale link as today.
            return parsed.isBefore(LocalDate.now()) ? LocalDate.now() : parsed;
        } catch (RuntimeException badFormat) {
            return LocalDate.now();
        }
    }

    /** The strip of dates, always starting today so "today" is never off-screen. */
    private List<LocalDate> nextDays(LocalDate around) {
        LocalDate start = LocalDate.now();
        if (around.isAfter(start.plusDays(DAYS_SHOWN - 1L))) {
            start = around;
        }
        List<LocalDate> days = new ArrayList<>(DAYS_SHOWN);
        for (int i = 0; i < DAYS_SHOWN; i++) {
            days.add(start.plusDays(i));
        }
        return days;
    }
}
