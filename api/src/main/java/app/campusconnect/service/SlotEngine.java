package app.campusconnect.service;

import app.campusconnect.domain.AvailabilityRule;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * The time-slot scheduling algorithm.
 *
 * Deliberately pure and static: no Spring, no database, no clock of its own.
 * Everything it needs is passed in, which means the single-day path, the
 * calendar-dots path and the bulk "next available for a page of search results"
 * path all share exactly one implementation of the rules — and it can be tested
 * without standing up a context.
 */
public final class SlotEngine {

    /** Appointments are offered on a 15-minute grid regardless of service length. */
    public static final int SLOT_STEP_MINUTES = 15;

    private SlotEngine() {
    }

    /**
     * Every bookable start time on one calendar day.
     *
     * A candidate survives only if it clears all five gates:
     *   1. it fits entirely inside a working window for that weekday
     *   2. the day is within the provider's advance-booking horizon
     *   3. it starts after now + the provider's minimum notice
     *   4. it does not collide with time off
     *   5. it does not collide with an existing booking, buffer included
     *
     * @param busy existing bookings AND time off, already expanded to instants.
     *             Bookings must be passed as [startAt, blockEndAt) so the
     *             provider's turnaround buffer counts as occupied.
     */
    public static List<Slot> computeDaySlots(LocalDate day,
                                             int durationMinutes,
                                             BookingPolicy policy,
                                             Collection<AvailabilityRule> rules,
                                             Collection<Interval> busy,
                                             LocalDateTime now) {
        List<Slot> slots = new ArrayList<>();
        if (durationMinutes <= 0) {
            return slots;
        }

        LocalDate today = now.toLocalDate();
        if (day.isBefore(today) || day.isAfter(today.plusDays(policy.maxAdvanceDays()))) {
            return slots;
        }

        LocalDateTime earliest = now.plusMinutes(policy.minNoticeMinutes());

        for (AvailabilityRule rule : rules) {
            if (rule.getDayOfWeek() != day.getDayOfWeek()) {
                continue;
            }

            for (int minute = rule.getStartMinute();
                 minute + durationMinutes <= rule.getEndMinute();
                 minute += SLOT_STEP_MINUTES) {

                LocalDateTime start = day.atStartOfDay().plusMinutes(minute);
                LocalDateTime end = start.plusMinutes(durationMinutes);
                // The provider stays occupied until the buffer clears, even
                // though the customer's appointment ended earlier.
                LocalDateTime blockEnd = end.plusMinutes(policy.bufferMinutes());

                if (start.isBefore(earliest)) {
                    continue;
                }

                Interval candidate = new Interval(start, blockEnd);
                boolean clash = busy.stream().anyMatch(candidate::overlaps);
                if (clash) {
                    continue;
                }

                slots.add(new Slot(start, end));
            }
        }

        slots.sort((a, b) -> a.startAt().compareTo(b.startAt()));
        return slots;
    }

    /**
     * First bookable moment within the lookahead, or null.
     * Used for the "Next available: Today 5:30 PM" line on every provider card.
     */
    public static LocalDateTime firstAvailable(int durationMinutes,
                                               BookingPolicy policy,
                                               Collection<AvailabilityRule> rules,
                                               Collection<Interval> busy,
                                               LocalDateTime now,
                                               int lookaheadDays) {
        for (int offset = 0; offset <= lookaheadDays; offset++) {
            List<Slot> slots = computeDaySlots(
                    now.toLocalDate().plusDays(offset), durationMinutes, policy, rules, busy, now);
            if (!slots.isEmpty()) {
                return slots.get(0).startAt();
            }
        }
        return null;
    }
}
