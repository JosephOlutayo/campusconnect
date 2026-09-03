package app.campusconnect.service;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The single write path for bookings. Every state transition lives here so
 * authorisation, payment side effects and notifications cannot drift apart.
 */
@Service
public class BookingService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final BookingRepository bookings;
    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final UserRepository users;
    private final PromotionRepository promotions;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final SettingsService settingsService;

    public BookingService(BookingRepository bookings,
                          ProviderProfileRepository providers,
                          ServiceOfferingRepository services,
                          UserRepository users,
                          PromotionRepository promotions,
                          PaymentService paymentService,
                          NotificationService notificationService,
                          SettingsService settingsService) {
        this.bookings = bookings;
        this.providers = providers;
        this.services = services;
        this.users = users;
        this.promotions = promotions;
        this.paymentService = paymentService;
        this.notificationService = notificationService;
        this.settingsService = settingsService;
    }

    private static String generateCode() {
        StringBuilder builder = new StringBuilder("CC-");
        for (int i = 0; i < 6; i++) {
            builder.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return builder.toString();
    }

    /**
     * DOUBLE-BOOKING PREVENTION
     *
     * Two students can press Confirm on the same 5:30 slot in the same second.
     * The UI only ever offers free slots and the controller pre-checks, but
     * neither of those is a guarantee — both can pass before either writes.
     *
     * The guarantee is here, and it has two parts:
     *
     *   1. A pessimistic write lock on the provider row (SELECT ... FOR UPDATE)
     *      taken as the FIRST statement in the transaction. Every booking for a
     *      given provider therefore serialises at this point. We lock the
     *      provider rather than the slot because slots are computed, not stored,
     *      so there is no slot row to lock.
     *
     *   2. The overlap check runs AFTER that lock is held. The loser of the race
     *      only reaches it once the winner has committed, so it sees the new
     *      booking and aborts with 409.
     *
     * REQUIRES_NEW plus SERIALIZABLE keeps this correct even if a caller already
     * has a longer-running read transaction open.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public Booking create(UUID customerId,
                          UUID serviceId,
                          LocalDateTime startAt,
                          LocationMode locationMode,
                          String customerNote,
                          String customerLocationHint,
                          String promoCode) {

        ServiceOffering service = services.findById(serviceId)
                .orElseThrow(() -> ApiException.notFound("That service is no longer available."));
        if (!service.isActive()) {
            throw ApiException.badRequest("That service is no longer available.");
        }

        // (1) Serialise all bookings for this provider from here on.
        ProviderProfile provider = providers.findByIdForUpdate(service.getProvider().getId())
                .orElseThrow(() -> ApiException.notFound("Provider not found."));

        if (provider.getStatus() != ProviderStatus.ACTIVE) {
            throw ApiException.badRequest("This provider is not taking bookings.");
        }
        if (provider.getUser().getId().equals(customerId)) {
            throw ApiException.badRequest("You cannot book your own service.");
        }
        if (!service.effectiveLocationModes().contains(locationMode)) {
            throw ApiException.badRequest("That location option is not offered for this service.");
        }

        LocalDateTime now = LocalDateTime.now();
        if (startAt.isBefore(now.plusMinutes(provider.getMinNoticeMinutes()))) {
            throw ApiException.badRequest(provider.getBusinessName()
                    + " needs at least " + provider.getMinNoticeMinutes() + " minutes notice.");
        }

        LocalDateTime endAt = startAt.plusMinutes(service.getDurationMinutes());
        LocalDateTime blockEndAt = endAt.plusMinutes(provider.getBufferMinutes());

        // (2) Authoritative overlap check, holding the lock.
        if (bookings.existsOverlap(provider.getId(), startAt, blockEndAt, BookingStatus.BLOCKING, null)) {
            throw ApiException.conflict("That time was just booked. Please choose another slot.");
        }

        Promotion promotion = null;
        if (promoCode != null && !promoCode.isBlank()) {
            promotion = promotions
                    .findByProviderIdAndCodeIgnoreCase(provider.getId(), promoCode.trim())
                    .filter(p -> p.redeemableAt(now))
                    .orElseThrow(() -> ApiException.badRequest("That promo code is not valid right now."));
        }

        int priceCents = Money.applyDiscount(service.getPriceCents(), promotion);
        Money.FeeSplit split = Money.split(priceCents, settingsService.platformFeePercent());

        User customer = users.findById(customerId)
                .orElseThrow(() -> ApiException.unauthorized("Sign in to book an appointment."));

        boolean autoConfirm = provider.isAutoConfirmBookings();
        Booking booking = new Booking(
                generateCode(), customer, provider, service,
                startAt, endAt, blockEndAt,
                autoConfirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
                split.totalCents(), split.platformFeeCents(), split.providerPayoutCents(),
                locationMode, resolveLocationLabel(locationMode, provider, customerLocationHint),
                (customerNote == null || customerNote.isBlank()) ? null : customerNote.trim());

        if (autoConfirm) {
            booking.setConfirmedAt(java.time.Instant.now());
        }
        booking = bookings.save(booking);

        paymentService.authorize(booking, split);

        service.setBookingCount(service.getBookingCount() + 1);
        services.save(service);

        if (promotion != null) {
            promotion.setRedemptions(promotion.getRedemptions() + 1);
            promotions.save(promotion);
        }

        String when = startAt.toLocalDate() + " at " + startAt.toLocalTime();
        notificationService.notify(provider.getUser(),
                autoConfirm ? NotificationType.BOOKING_CONFIRMED : NotificationType.BOOKING_CREATED,
                autoConfirm ? "New booking" : "Booking request",
                customer.getName() + " booked " + service.getTitle() + " — " + when + ".",
                "/provider/bookings/" + booking.getId());
        notificationService.notify(customer,
                autoConfirm ? NotificationType.BOOKING_CONFIRMED : NotificationType.BOOKING_CREATED,
                autoConfirm ? "Booking confirmed" : "Request sent",
                autoConfirm
                        ? "You are booked with " + provider.getBusinessName() + " — " + when + "."
                        : provider.getBusinessName() + " will confirm your request shortly.",
                "/appointments/" + booking.getId());

        return booking;
    }

    private String resolveLocationLabel(LocationMode mode, ProviderProfile provider, String hint) {
        return switch (mode) {
            case ONLINE -> "Online";
            case AT_CUSTOMER -> (hint == null || hint.isBlank()) ? "Your location" : hint.trim();
            case AT_PROVIDER -> provider.getLocationLabel();
        };
    }

    private Booking load(UUID bookingId) {
        return bookings.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Booking not found."));
    }

    private void requireProvider(Booking booking, UUID actingUserId) {
        if (!booking.getProvider().getUser().getId().equals(actingUserId)) {
            throw ApiException.forbidden("Not allowed.");
        }
    }

    @Transactional
    public Booking confirm(UUID bookingId, UUID actingUserId) {
        Booking booking = load(bookingId);
        requireProvider(booking, actingUserId);
        if (booking.getStatus() != BookingStatus.PENDING) {
            throw ApiException.badRequest("Only pending requests can be confirmed.");
        }
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConfirmedAt(java.time.Instant.now());

        notificationService.notify(booking.getCustomer(), NotificationType.BOOKING_CONFIRMED,
                "Booking confirmed",
                booking.getProvider().getBusinessName() + " confirmed your appointment.",
                "/appointments/" + bookingId);
        return bookings.save(booking);
    }

    @Transactional
    public Booking decline(UUID bookingId, UUID actingUserId, String reason) {
        Booking booking = load(bookingId);
        requireProvider(booking, actingUserId);
        if (booking.getStatus() != BookingStatus.PENDING) {
            throw ApiException.badRequest("Only pending requests can be declined.");
        }
        paymentService.refund(bookingId);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(java.time.Instant.now());
        booking.setCancelledByUserId(actingUserId);
        booking.setCancellationReason(
                (reason == null || reason.isBlank()) ? "Declined by provider" : reason.trim());

        notificationService.notify(booking.getCustomer(), NotificationType.BOOKING_DECLINED,
                "Booking declined",
                booking.getProvider().getBusinessName() + " could not take your appointment.",
                "/appointments/" + bookingId);
        return bookings.save(booking);
    }

    @Transactional
    public Booking cancel(UUID bookingId, UUID actingUserId, String reason) {
        Booking booking = load(bookingId);
        boolean isCustomer = booking.getCustomer().getId().equals(actingUserId);
        boolean isProvider = booking.getProvider().getUser().getId().equals(actingUserId);
        if (!isCustomer && !isProvider) {
            throw ApiException.forbidden("Not allowed.");
        }
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw ApiException.badRequest("Already cancelled.");
        }
        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw ApiException.badRequest("Completed appointments cannot be cancelled.");
        }

        paymentService.refund(bookingId);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(java.time.Instant.now());
        booking.setCancelledByUserId(actingUserId);
        booking.setCancellationReason((reason == null || reason.isBlank()) ? null : reason.trim());

        User recipient = isCustomer ? booking.getProvider().getUser() : booking.getCustomer();
        String who = isCustomer ? booking.getCustomer().getName() : booking.getProvider().getBusinessName();
        notificationService.notify(recipient, NotificationType.BOOKING_CANCELLED,
                "Appointment cancelled",
                who + " cancelled " + booking.getService().getTitle() + ".",
                isCustomer ? "/provider/bookings/" + bookingId : "/appointments/" + bookingId);

        return bookings.save(booking);
    }

    /** Same locking discipline as create — the new time must be free too. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public Booking reschedule(UUID bookingId, UUID actingUserId, LocalDateTime newStartAt) {
        Booking booking = load(bookingId);
        boolean isCustomer = booking.getCustomer().getId().equals(actingUserId);
        boolean isProvider = booking.getProvider().getUser().getId().equals(actingUserId);
        if (!isCustomer && !isProvider) {
            throw ApiException.forbidden("Not allowed.");
        }
        if (!booking.isUpcoming()) {
            throw ApiException.badRequest("Only upcoming appointments can be rescheduled.");
        }

        ProviderProfile provider = providers.findByIdForUpdate(booking.getProvider().getId())
                .orElseThrow(() -> ApiException.notFound("Provider not found."));

        LocalDateTime endAt = newStartAt.plusMinutes(booking.getService().getDurationMinutes());
        LocalDateTime blockEndAt = endAt.plusMinutes(provider.getBufferMinutes());

        if (bookings.existsOverlap(provider.getId(), newStartAt, blockEndAt,
                BookingStatus.BLOCKING, bookingId)) {
            throw ApiException.conflict("That time is already taken.");
        }

        booking.setStartAt(newStartAt);
        booking.setEndAt(endAt);
        booking.setBlockEndAt(blockEndAt);

        User recipient = isCustomer ? provider.getUser() : booking.getCustomer();
        notificationService.notify(recipient, NotificationType.BOOKING_RESCHEDULED,
                "Appointment moved",
                booking.getService().getTitle() + " is now " + newStartAt.toLocalDate()
                        + " at " + newStartAt.toLocalTime() + ".",
                isCustomer ? "/provider/bookings/" + bookingId : "/appointments/" + bookingId);

        return bookings.save(booking);
    }

    @Transactional
    public Booking complete(UUID bookingId, UUID actingUserId) {
        Booking booking = load(bookingId);
        requireProvider(booking, actingUserId);
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw ApiException.badRequest("Only confirmed appointments can be completed.");
        }

        paymentService.capture(bookingId);
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setCompletedAt(java.time.Instant.now());

        ProviderProfile provider = booking.getProvider();
        provider.setCompletedBookings(provider.getCompletedBookings() + 1);
        providers.save(provider);

        notificationService.notify(booking.getCustomer(), NotificationType.BOOKING_COMPLETED,
                "How did it go?",
                "Leave " + provider.getBusinessName() + " a review — it takes 20 seconds.",
                "/appointments/" + bookingId + "?review=1");

        return bookings.save(booking);
    }

    @Transactional
    public Booking markNoShow(UUID bookingId, UUID actingUserId) {
        Booking booking = load(bookingId);
        requireProvider(booking, actingUserId);
        if (!booking.isUpcoming()) {
            throw ApiException.badRequest("Only upcoming appointments can be marked as a no-show.");
        }
        booking.setStatus(BookingStatus.NO_SHOW);
        booking.setCompletedAt(java.time.Instant.now());
        return bookings.save(booking);
    }

    @Transactional(readOnly = true)
    public Booking viewableBy(UUID bookingId, UUID userId, boolean isAdmin) {
        Booking booking = load(bookingId);
        boolean allowed = isAdmin
                || booking.getCustomer().getId().equals(userId)
                || booking.getProvider().getUser().getId().equals(userId);
        if (!allowed) {
            throw ApiException.notFound("Booking not found.");
        }
        return booking;
    }

    @Transactional(readOnly = true)
    public List<Booking> upcomingForCustomer(UUID customerId) {
        return bookings.findUpcomingForCustomer(customerId, BookingStatus.BLOCKING, LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public List<Booking> historyForCustomer(UUID customerId) {
        return bookings.findHistoryForCustomer(customerId,
                List.of(BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW),
                LocalDateTime.now());
    }
}
