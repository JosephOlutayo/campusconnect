package app.campusconnect.view;

import app.campusconnect.domain.Booking;
import app.campusconnect.domain.BookingStatus;
import app.campusconnect.repository.BookingRepository;
import app.campusconnect.repository.ReviewRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.BookingService;
import app.campusconnect.web.ApiException;
import app.campusconnect.web.dto.BookingDtos.BookingDto;
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
import java.util.List;
import java.util.UUID;

/**
 * A student's appointments: the list, one booking in full, and cancelling.
 *
 * Bookings are mapped through BookingDto rather than handed to the template as
 * entities. That is where the rule lives that a provider's exact address is
 * released only to the customer, and only once the booking is confirmed — so
 * routing this page through the same mapper means the rule cannot be forgotten
 * here the way it could be if the template read the entity directly.
 */
@Controller
public class AppointmentViewController {

    /** Anything still ahead of the student. */
    private static final List<BookingStatus> UPCOMING =
            List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED);

    /** Everything settled, one way or another. */
    private static final List<BookingStatus> PAST =
            List.of(BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW);

    private final BookingRepository bookings;
    private final BookingService bookingService;
    private final ReviewRepository reviews;

    public AppointmentViewController(BookingRepository bookings,
                                     BookingService bookingService,
                                     ReviewRepository reviews) {
        this.bookings = bookings;
        this.bookingService = bookingService;
        this.reviews = reviews;
    }

    @GetMapping("/appointments")
    @Transactional(readOnly = true)
    public String list(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        LocalDateTime now = LocalDateTime.now();

        model.addAttribute("active", "appointments");
        model.addAttribute("upcoming",
                bookings.findUpcomingForCustomer(me.id(), UPCOMING, now).stream()
                        .map(b -> toDto(b, me.id()))
                        .toList());
        model.addAttribute("past",
                bookings.findHistoryForCustomer(me.id(), PAST, now).stream()
                        .map(b -> toDto(b, me.id()))
                        .toList());
        return "appointments";
    }

    @GetMapping("/appointments/{id}")
    @Transactional(readOnly = true)
    public String detail(@PathVariable UUID id,
                         @RequestParam(required = false) String error,
                         @CurrentUser AuthenticatedUser me,
                         Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        // viewableBy is the authorisation check: it throws unless this person is
        // the customer, the provider, or an admin.
        Booking booking = bookingService.viewableBy(id, me.id(), me.isAdmin());

        model.addAttribute("active", "appointments");
        model.addAttribute("booking", toDto(booking, me.id()));
        model.addAttribute("isCustomer", booking.getCustomer().getId().equals(me.id()));
        model.addAttribute("cancelError", error);
        return "appointment";
    }

    /**
     * Not @Transactional — BookingService.cancel manages its own, and a second
     * one here would mark itself rollback-only when the service refuses,
     * turning a refusal into a 500.
     */
    @PostMapping("/appointments/{id}/cancel")
    public String cancel(@PathVariable UUID id,
                         @RequestParam(required = false) String reason,
                         @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login";
        }
        try {
            bookingService.cancel(id, me.id(), reason);
            return "redirect:/appointments/" + id;
        } catch (ApiException refused) {
            // Query parameter, not a flash attribute: the app is STATELESS, so
            // flash storage is discarded and the page would explain nothing.
            return "redirect:/appointments/" + id
                    + "?error=" + URLEncoder.encode(refused.getMessage(), StandardCharsets.UTF_8);
        }
    }

    /**
     * Loads the associations the template reads before the transaction closes.
     * open-in-view is off, so a lazy read during rendering fails the page.
     */
    private BookingDto toDto(Booking booking, UUID viewerId) {
        boolean reviewed = reviews.existsByBookingId(booking.getId());
        Integer rating = reviews.findByBookingId(booking.getId())
                .map(review -> review.getRating())
                .orElse(null);
        return BookingDto.of(booking, viewerId, reviewed, rating);
    }
}
