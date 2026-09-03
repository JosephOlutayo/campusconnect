package app.campusconnect.service;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.web.ApiException;
import app.campusconnect.web.dto.ProviderDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/** Everything a provider does to their own business. */
@Service
public class ProviderService {

    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final CategoryRepository categories;
    private final AvailabilityRuleRepository rules;
    private final TimeOffRepository timeOff;
    private final BookingRepository bookings;
    private final PromotionRepository promotions;
    private final UserRepository users;
    private final SettingsService settingsService;

    public ProviderService(ProviderProfileRepository providers, ServiceOfferingRepository services,
                           CategoryRepository categories, AvailabilityRuleRepository rules,
                           TimeOffRepository timeOff, BookingRepository bookings,
                           PromotionRepository promotions, UserRepository users,
                           SettingsService settingsService) {
        this.providers = providers;
        this.services = services;
        this.categories = categories;
        this.rules = rules;
        this.timeOff = timeOff;
        this.bookings = bookings;
        this.promotions = promotions;
        this.users = users;
        this.settingsService = settingsService;
    }

    @Transactional(readOnly = true)
    public ProviderProfile requireOwned(UUID userId) {
        return providers.findByUserId(userId)
                .orElseThrow(() -> ApiException.forbidden("Create a provider profile first."));
    }

    /**
     * Creates the profile, the first service, a default working week and the
     * role promotion in one transaction — a half-built business can never exist.
     */
    @Transactional
    public ProviderProfile onboard(UUID userId, OnboardingRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Sign in first."));
        if (providers.findByUserId(userId).isPresent()) {
            throw new ApiException("You already have a provider profile.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        if (user.getUniversity() == null) {
            throw ApiException.badRequest("Add your university before offering services.");
        }
        Category category = categories.findById(request.categoryId())
                .orElseThrow(() -> ApiException.badRequest("Pick a category from the list."));

        University university = user.getUniversity();
        // Placed near campus with a deliberate blur — an exact home address is
        // never used for the public map position.
        double[] point = Geo.approximate(university.getLatitude(), university.getLongitude(),
                user.getId().toString());

        ProviderProfile profile = new ProviderProfile(user, request.businessName().trim(),
                request.bio().trim(), university, request.locationLabel().trim(), point[0], point[1]);
        profile.setTagline(request.tagline());
        profile.setExactAddress(request.exactAddress());
        profile.setLocationModes(new LinkedHashSet<>(request.locationModes()));
        profile.setStatus(settingsService.providerAutoApprove()
                ? ProviderStatus.ACTIVE : ProviderStatus.PENDING);
        profile = providers.save(profile);

        ServiceOffering service = new ServiceOffering(profile, category,
                request.serviceTitle().trim(), request.serviceDescription().trim(),
                request.priceCents(), request.durationMinutes(),
                new LinkedHashSet<>(request.locationModes()));
        services.save(service);

        // Monday-Friday 10:00-18:00. Editable immediately, but it means a brand
        // new provider is bookable the moment they finish onboarding.
        List<AvailabilityRule> defaults = new ArrayList<>();
        for (DayOfWeek day : List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY)) {
            defaults.add(new AvailabilityRule(profile, day, 10 * 60, 18 * 60));
        }
        rules.saveAll(defaults);

        user.setRole(Role.PROVIDER);
        users.save(user);

        return profile;
    }

    @Transactional
    public ProviderProfile updateSettings(UUID userId, BusinessSettingsRequest request) {
        ProviderProfile profile = requireOwned(userId);

        ProviderStatus requested;
        try {
            requested = ProviderStatus.valueOf(request.status());
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("Unknown status.");
        }
        // A provider can pause or resume themselves, but cannot promote their
        // way out of PENDING/REJECTED/SUSPENDED — only an admin does that.
        if (requested != ProviderStatus.ACTIVE && requested != ProviderStatus.PAUSED) {
            throw ApiException.forbidden("You cannot set that status.");
        }
        if (profile.getStatus() == ProviderStatus.SUSPENDED
                || profile.getStatus() == ProviderStatus.REJECTED
                || profile.getStatus() == ProviderStatus.PENDING) {
            throw ApiException.forbidden("Your listing is under review by an admin.");
        }

        profile.setBusinessName(request.businessName().trim());
        profile.setTagline(request.tagline());
        profile.setBio(request.bio().trim());
        profile.setLocationLabel(request.locationLabel().trim());
        profile.setExactAddress(request.exactAddress());
        profile.setLocationModes(new LinkedHashSet<>(request.locationModes()));
        profile.setAutoConfirmBookings(request.autoConfirmBookings());
        profile.setBufferMinutes(request.bufferMinutes());
        profile.setMinNoticeMinutes(request.minNoticeMinutes());
        profile.setMaxAdvanceDays(request.maxAdvanceDays());
        profile.setCancellationPolicy(request.cancellationPolicy().trim());
        profile.setStatus(requested);

        return providers.save(profile);
    }

    @Transactional
    public ServiceOffering addService(UUID userId, ServiceRequest request) {
        ProviderProfile profile = requireOwned(userId);
        Category category = categories.findById(request.categoryId())
                .orElseThrow(() -> ApiException.badRequest("Pick a category from the list."));

        ServiceOffering service = new ServiceOffering(profile, category,
                request.title().trim(), request.description().trim(),
                request.priceCents(), request.durationMinutes(),
                request.locationModes() == null
                        ? new LinkedHashSet<>()
                        : new LinkedHashSet<>(request.locationModes()));
        if (request.active() != null) {
            service.setActive(request.active());
        }
        return services.save(service);
    }

    @Transactional
    public ServiceOffering updateService(UUID userId, UUID serviceId, ServiceRequest request) {
        ProviderProfile profile = requireOwned(userId);
        ServiceOffering service = services.findById(serviceId)
                .orElseThrow(() -> ApiException.notFound("Service not found."));
        if (!service.getProvider().getId().equals(profile.getId())) {
            throw ApiException.notFound("Service not found.");
        }

        if (request.title() != null) service.setTitle(request.title().trim());
        if (request.description() != null) service.setDescription(request.description().trim());
        if (request.categoryId() != null) {
            service.setCategory(categories.findById(request.categoryId())
                    .orElseThrow(() -> ApiException.badRequest("Pick a category from the list.")));
        }
        if (request.priceCents() > 0) service.setPriceCents(request.priceCents());
        if (request.durationMinutes() > 0) service.setDurationMinutes(request.durationMinutes());
        if (request.locationModes() != null) {
            service.setLocationModes(new LinkedHashSet<>(request.locationModes()));
        }
        if (request.active() != null) service.setActive(request.active());

        return services.save(service);
    }

    /**
     * Services with history are retired, not deleted — past bookings reference
     * them for their title and price snapshot.
     */
    @Transactional
    public boolean removeService(UUID userId, UUID serviceId) {
        ProviderProfile profile = requireOwned(userId);
        ServiceOffering service = services.findById(serviceId)
                .orElseThrow(() -> ApiException.notFound("Service not found."));
        if (!service.getProvider().getId().equals(profile.getId())) {
            throw ApiException.notFound("Service not found.");
        }

        boolean hasHistory = !bookings.findByProviderIdOrderByStartAtDesc(profile.getId()).stream()
                .filter(booking -> booking.getService().getId().equals(serviceId))
                .toList().isEmpty();

        if (hasHistory) {
            service.setActive(false);
            services.save(service);
            return false;
        }
        services.delete(service);
        return true;
    }

    /**
     * The week is replaced wholesale rather than diffed — the editor always
     * sends the complete schedule, so delete-then-insert in one transaction is
     * simpler and cannot be left half-applied.
     */
    @Transactional
    public int replaceAvailability(UUID userId, AvailabilityRequest request) {
        ProviderProfile profile = requireOwned(userId);

        for (AvailabilityWindow window : request.windows()) {
            if (window.endMinute() <= window.startMinute()) {
                throw ApiException.badRequest("Each window must end after it starts.");
            }
        }

        rules.deleteByProviderId(profile.getId());
        rules.flush();

        List<AvailabilityRule> fresh = request.windows().stream()
                .map(window -> {
                    DayOfWeek day;
                    try {
                        day = DayOfWeek.valueOf(window.dayOfWeek().toUpperCase());
                    } catch (IllegalArgumentException ex) {
                        throw ApiException.badRequest("Unknown day: " + window.dayOfWeek());
                    }
                    return new AvailabilityRule(profile, day, window.startMinute(), window.endMinute());
                })
                .toList();
        rules.saveAll(fresh);
        return fresh.size();
    }

    @Transactional
    public TimeOff addTimeOff(UUID userId, TimeOffRequest request) {
        ProviderProfile profile = requireOwned(userId);
        if (!request.endAt().isAfter(request.startAt())) {
            throw ApiException.badRequest("The block must end after it starts.");
        }
        return timeOff.save(new TimeOff(profile, request.startAt(), request.endAt(), request.reason()));
    }

    @Transactional
    public void removeTimeOff(UUID userId, UUID timeOffId) {
        ProviderProfile profile = requireOwned(userId);
        timeOff.findById(timeOffId)
                .filter(entry -> entry.getProvider().getId().equals(profile.getId()))
                .ifPresent(timeOff::delete);
    }

    @Transactional
    public Promotion addPromotion(UUID userId, PromotionRequest request) {
        ProviderProfile profile = requireOwned(userId);
        if (!request.endsAt().isAfter(request.startsAt())) {
            throw ApiException.badRequest("The promo must end after it starts.");
        }
        DiscountType type;
        try {
            type = DiscountType.valueOf(request.discountType());
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("Discount type must be PERCENT or AMOUNT.");
        }
        if (type == DiscountType.PERCENT && request.discountValue() > 90) {
            throw ApiException.badRequest("Percentage discounts cap at 90%.");
        }
        String code = request.code().toUpperCase();
        if (promotions.findByProviderIdAndCodeIgnoreCase(profile.getId(), code).isPresent()) {
            throw new ApiException("You already have a promo with that code.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        return promotions.save(new Promotion(profile, code, request.description(), type,
                request.discountValue(), request.startsAt(), request.endsAt(), request.maxRedemptions()));
    }

    /** Dashboard headline numbers plus a four-week earnings series. */
    @Transactional(readOnly = true)
    public ProviderStatsDto stats(UUID userId) {
        ProviderProfile profile = requireOwned(userId);
        UUID providerId = profile.getId();

        long pending = bookings.countByProviderIdAndStatus(providerId, BookingStatus.PENDING);
        long upcoming = bookings.findByProviderIdAndStatusOrderByStartAtAsc(providerId, BookingStatus.CONFIRMED)
                .stream().filter(booking -> booking.getStartAt().isAfter(LocalDateTime.now())).count();
        long completed = bookings.countByProviderIdAndStatus(providerId, BookingStatus.COMPLETED);
        long earnedAllTime = bookings.sumProviderEarnings(providerId);

        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        List<Booking> monthBookings = bookings.findForProviderBetween(providerId,
                monthStart.atStartOfDay(), today.plusDays(1).atStartOfDay());

        long earnedThisMonth = monthBookings.stream()
                .filter(booking -> booking.getStatus() == BookingStatus.COMPLETED)
                .mapToLong(Booking::getProviderPayoutCents)
                .sum();

        List<ProviderStatsDto.WeekBucket> weeks = new ArrayList<>();
        for (int index = 3; index >= 0; index--) {
            LocalDate weekStart = today.minusWeeks(index).with(DayOfWeek.MONDAY);
            LocalDate weekEnd = weekStart.plusWeeks(1);
            List<Booking> inWeek = bookings.findForProviderBetween(providerId,
                    weekStart.atStartOfDay(), weekEnd.atStartOfDay());
            long amount = inWeek.stream()
                    .filter(booking -> booking.getStatus() == BookingStatus.COMPLETED)
                    .mapToLong(Booking::getProviderPayoutCents)
                    .sum();
            weeks.add(new ProviderStatsDto.WeekBucket(
                    index == 0 ? "This wk" : "Wk " + (4 - index), amount, inWeek.size()));
        }

        return new ProviderStatsDto(pending, upcoming, completed, earnedAllTime, earnedThisMonth,
                profile.getRatingAvg(), profile.getRatingCount(), weeks);
    }

}
