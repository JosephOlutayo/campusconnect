package app.campusconnect.service;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Loads what {@link SlotEngine} needs and delegates the actual rules to it.
 *
 * The batch method matters: a page of twelve search results each needs a "next
 * available" line, and doing that one provider at a time would be N+1 queries
 * per page load. Here the whole window comes back in three queries and the
 * engine runs in memory.
 */
@Service
public class AvailabilityService {

    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules;
    private final TimeOffRepository timeOff;
    private final BookingRepository bookings;

    public AvailabilityService(ProviderProfileRepository providers,
                               ServiceOfferingRepository services,
                               AvailabilityRuleRepository rules,
                               TimeOffRepository timeOff,
                               BookingRepository bookings) {
        this.providers = providers;
        this.services = services;
        this.rules = rules;
        this.timeOff = timeOff;
        this.bookings = bookings;
    }

    /** Everything occupying a provider's calendar in a window. */
    private List<Interval> busyFor(UUID providerId, LocalDateTime from, LocalDateTime to, UUID excludeBookingId) {
        List<Interval> busy = new ArrayList<>();
        for (Booking booking : bookings.findBlockingInWindow(providerId, from, to, BookingStatus.BLOCKING)) {
            // Rescheduling must not treat the booking being moved as a conflict.
            if (excludeBookingId != null && booking.getId().equals(excludeBookingId)) {
                continue;
            }
            busy.add(new Interval(booking.getStartAt(), booking.getBlockEndAt()));
        }
        for (TimeOff off : timeOff.findOverlapping(providerId, from, to)) {
            busy.add(new Interval(off.getStartAt(), off.getEndAt()));
        }
        return busy;
    }

    @Transactional(readOnly = true)
    public List<Slot> slotsForDay(UUID serviceId, LocalDate day, UUID excludeBookingId) {
        ServiceOffering service = services.findById(serviceId).orElse(null);
        if (service == null || !service.isActive()) {
            return List.of();
        }
        ProviderProfile provider = service.getProvider();

        LocalDateTime from = day.atStartOfDay();
        LocalDateTime to = day.plusDays(1).atStartOfDay();

        return SlotEngine.computeDaySlots(
                day,
                service.getDurationMinutes(),
                BookingPolicy.from(provider),
                rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(provider.getId()),
                busyFor(provider.getId(), from, to, excludeBookingId),
                LocalDateTime.now());
    }

    /** Which days in a window have at least one opening — drives the calendar dots. */
    @Transactional(readOnly = true)
    public List<LocalDate> openDays(UUID serviceId, LocalDate from, int days, UUID excludeBookingId) {
        ServiceOffering service = services.findById(serviceId).orElse(null);
        if (service == null || !service.isActive()) {
            return List.of();
        }
        ProviderProfile provider = service.getProvider();

        LocalDateTime windowStart = from.atStartOfDay();
        LocalDateTime windowEnd = from.plusDays(days + 1L).atStartOfDay();

        List<AvailabilityRule> providerRules =
                rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(provider.getId());
        List<Interval> busy = busyFor(provider.getId(), windowStart, windowEnd, excludeBookingId);
        BookingPolicy policy = BookingPolicy.from(provider);
        LocalDateTime now = LocalDateTime.now();

        List<LocalDate> open = new ArrayList<>();
        for (int offset = 0; offset <= days; offset++) {
            LocalDate day = from.plusDays(offset);
            if (!SlotEngine.computeDaySlots(day, service.getDurationMinutes(), policy,
                    providerRules, busy, now).isEmpty()) {
                open.add(day);
            }
        }
        return open;
    }

    @Transactional(readOnly = true)
    public LocalDateTime nextAvailable(UUID providerId, int durationMinutes, int lookaheadDays) {
        ProviderProfile provider = providers.findById(providerId).orElse(null);
        if (provider == null) {
            return null;
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowEnd = now.toLocalDate().plusDays(lookaheadDays + 1L).atStartOfDay();

        return SlotEngine.firstAvailable(
                durationMinutes,
                BookingPolicy.from(provider),
                rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(providerId),
                busyFor(providerId, now.toLocalDate().atStartOfDay(), windowEnd, null),
                now,
                lookaheadDays);
    }

    /**
     * Next-available for many providers at once. Three queries total, however
     * many providers are on the page.
     */
    @Transactional(readOnly = true)
    public Map<UUID, LocalDateTime> nextAvailableBatch(Map<UUID, Integer> durationByProvider, int lookaheadDays) {
        Map<UUID, LocalDateTime> result = new HashMap<>();
        if (durationByProvider.isEmpty()) {
            return result;
        }

        Set<UUID> providerIds = durationByProvider.keySet();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = now.toLocalDate().atStartOfDay();
        LocalDateTime windowEnd = now.toLocalDate().plusDays(lookaheadDays + 1L).atStartOfDay();

        Map<UUID, List<AvailabilityRule>> rulesByProvider = new HashMap<>();
        for (AvailabilityRule rule : rules.findByProviderIdIn(providerIds)) {
            rulesByProvider.computeIfAbsent(rule.getProvider().getId(), k -> new ArrayList<>()).add(rule);
        }

        Map<UUID, List<Interval>> busyByProvider = new HashMap<>();
        for (Booking booking : bookings.findBlockingInWindowForProviders(
                providerIds, windowStart, windowEnd, BookingStatus.BLOCKING)) {
            busyByProvider.computeIfAbsent(booking.getProvider().getId(), k -> new ArrayList<>())
                    .add(new Interval(booking.getStartAt(), booking.getBlockEndAt()));
        }
        for (TimeOff off : timeOff.findOverlappingForProviders(providerIds, windowStart, windowEnd)) {
            busyByProvider.computeIfAbsent(off.getProvider().getId(), k -> new ArrayList<>())
                    .add(new Interval(off.getStartAt(), off.getEndAt()));
        }

        Map<UUID, ProviderProfile> profiles = new HashMap<>();
        providers.findAllById(providerIds).forEach(p -> profiles.put(p.getId(), p));

        durationByProvider.forEach((providerId, duration) -> {
            ProviderProfile provider = profiles.get(providerId);
            if (provider == null) {
                return;
            }
            LocalDateTime first = SlotEngine.firstAvailable(
                    duration,
                    BookingPolicy.from(provider),
                    rulesByProvider.getOrDefault(providerId, List.of()),
                    busyByProvider.getOrDefault(providerId, List.of()),
                    now,
                    lookaheadDays);
            if (first != null) {
                result.put(providerId, first);
            }
        });

        return result;
    }

    /**
     * Is this exact start time still offerable? The UI only shows free slots,
     * but this is the check that actually gates a write.
     */
    @Transactional(readOnly = true)
    public boolean isSlotOffered(UUID serviceId, LocalDateTime startAt, UUID excludeBookingId) {
        return slotsForDay(serviceId, startAt.toLocalDate(), excludeBookingId).stream()
                .anyMatch(slot -> slot.startAt().equals(startAt));
    }
}
