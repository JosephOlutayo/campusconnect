package app.campusconnect.web;

import app.campusconnect.domain.Booking;
import app.campusconnect.repository.ReviewRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.AvailabilityService;
import app.campusconnect.service.BookingService;
import app.campusconnect.web.dto.BookingDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final AvailabilityService availabilityService;
    private final ReviewRepository reviews;

    public BookingController(BookingService bookingService,
                             AvailabilityService availabilityService,
                             ReviewRepository reviews) {
        this.bookingService = bookingService;
        this.availabilityService = availabilityService;
        this.reviews = reviews;
    }

    private BookingDto toDto(Booking booking, UUID viewerId) {
        var review = reviews.findByBookingId(booking.getId());
        return BookingDto.of(booking, viewerId, review.isPresent(),
                review.map(r -> r.getRating()).orElse(null));
    }

    /**
     * Re-reads the booking inside THIS request's transaction before mapping.
     *
     * BookingService.create and reschedule run at REQUIRES_NEW so their
     * SERIALIZABLE transaction stays isolated from any outer one. The entity
     * they hand back therefore belongs to a persistence context that has already
     * closed, and touching its lazy relations here would throw. Re-loading costs
     * one query and keeps the isolation guarantee intact.
     */
    private BookingDto reloadAndMap(Booking booking, AuthenticatedUser me) {
        Booking managed = bookingService.viewableBy(booking.getId(), me.id(), me.isAdmin());
        return toDto(managed, me.id());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ApiResponse<BookingDto>> create(@CurrentUser AuthenticatedUser me,
                                                          @Valid @RequestBody CreateBookingRequest request) {
        if (me == null) {
            throw ApiException.unauthorized("Sign in to book an appointment.");
        }

        // Friendly pre-flight for the common "slot went stale while the form was
        // open" case. It is NOT the guarantee — BookingService re-checks under a
        // row lock, which is what actually prevents a double booking.
        if (!availabilityService.isSlotOffered(request.serviceId(), request.startAt(), null)) {
            throw ApiException.conflict("That time is no longer available. Pick another slot.");
        }

        Booking booking = bookingService.create(
                me.id(), request.serviceId(), request.startAt(), request.locationMode(),
                request.customerNote(), request.customerLocationHint(), request.promoCode());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(reloadAndMap(booking, me)));
    }

    @GetMapping("/{id}")
    public ApiResponse<BookingDto> get(@CurrentUser AuthenticatedUser me, @PathVariable UUID id) {
        Booking booking = bookingService.viewableBy(id, me.id(), me.isAdmin());
        return ApiResponse.ok(toDto(booking, me.id()));
    }

    @GetMapping("/upcoming")
    public ApiResponse<List<BookingDto>> upcoming(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(bookingService.upcomingForCustomer(me.id()).stream()
                .map(booking -> toDto(booking, me.id())).toList());
    }

    @GetMapping("/history")
    public ApiResponse<List<BookingDto>> history(@CurrentUser AuthenticatedUser me) {
        return ApiResponse.ok(bookingService.historyForCustomer(me.id()).stream()
                .map(booking -> toDto(booking, me.id())).toList());
    }

    /**
     * Every state transition goes through one endpoint keyed on `action`, so
     * authorisation and notification live in one place rather than six
     * near-identical routes.
     */
    @PatchMapping("/{id}")
    @Transactional
    public ApiResponse<BookingDto> act(@CurrentUser AuthenticatedUser me,
                                       @PathVariable UUID id,
                                       @Valid @RequestBody BookingActionRequest request) {
        Booking result = switch (request.action().toLowerCase()) {
            case "confirm" -> bookingService.confirm(id, me.id());
            case "decline" -> bookingService.decline(id, me.id(), request.reason());
            case "cancel" -> bookingService.cancel(id, me.id(), request.reason());
            case "complete" -> bookingService.complete(id, me.id());
            case "no_show" -> bookingService.markNoShow(id, me.id());
            case "reschedule" -> {
                if (request.startAt() == null) {
                    throw ApiException.badRequest("startAt is required to reschedule.");
                }
                yield bookingService.reschedule(id, me.id(), request.startAt());
            }
            default -> throw ApiException.badRequest("Unknown action: " + request.action());
        };
        return ApiResponse.ok(reloadAndMap(result, me));
    }
}
