package app.campusconnect.service;

import app.campusconnect.domain.AvailabilityRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The slot engine is pure, so its rules can be pinned down exactly — no Spring
 * context, no database, no clock of its own. Every case below is a rule the
 * booking flow depends on.
 */
class SlotEngineTest {

    /** Monday 2026-09-07, so the weekday is unambiguous. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 7);
    /** Well before the working window, so minimum notice never interferes. */
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 7, 6, 0);

    private static final BookingPolicy NO_FRICTION = new BookingPolicy(0, 0, 60);

    private AvailabilityRule rule(int startHour, int endHour) {
        return new AvailabilityRule(null, DayOfWeek.MONDAY, startHour * 60, endHour * 60);
    }

    @Test
    @DisplayName("walks the window on a 15-minute grid")
    void generatesSlotsOnTheGrid() {
        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 30, NO_FRICTION, List.of(rule(10, 12)), List.of(), NOW);

        // 10:00 .. 11:30 inclusive = 7 starts; 11:45 would end at 12:15, past close.
        assertThat(slots).hasSize(7);
        assertThat(slots.get(0).startAt()).isEqualTo(LocalDateTime.of(2026, 9, 7, 10, 0));
        assertThat(slots.get(slots.size() - 1).startAt()).isEqualTo(LocalDateTime.of(2026, 9, 7, 11, 30));
    }

    @Test
    @DisplayName("never offers a slot that would run past closing time")
    void respectsWindowEnd() {
        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 90, NO_FRICTION, List.of(rule(10, 12)), List.of(), NOW);

        assertThat(slots).hasSize(3); // 10:00, 10:15, 10:30
        assertThat(slots.get(slots.size() - 1).endAt()).isEqualTo(LocalDateTime.of(2026, 9, 7, 12, 0));
    }

    @Test
    @DisplayName("ignores rules for other weekdays")
    void ignoresOtherWeekdays() {
        AvailabilityRule tuesday = new AvailabilityRule(null, DayOfWeek.TUESDAY, 600, 720);
        assertThat(SlotEngine.computeDaySlots(MONDAY, 30, NO_FRICTION, List.of(tuesday), List.of(), NOW))
                .isEmpty();
    }

    @Test
    @DisplayName("split shifts leave a real gap — this is how breaks are expressed")
    void supportsSplitShifts() {
        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 60, NO_FRICTION, List.of(rule(9, 12), rule(14, 17)), List.of(), NOW);

        assertThat(slots).extracting(s -> s.startAt().getHour())
                .doesNotContain(12, 13)
                .contains(9, 11, 14, 16);
    }

    @Test
    @DisplayName("an existing booking removes the overlapping slots")
    void excludesBookedTime() {
        Interval busy = new Interval(
                LocalDateTime.of(2026, 9, 7, 10, 30),
                LocalDateTime.of(2026, 9, 7, 11, 0));

        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 30, NO_FRICTION, List.of(rule(10, 12)), List.of(busy), NOW);

        assertThat(slots).extracting(Slot::startAt)
                .doesNotContain(LocalDateTime.of(2026, 9, 7, 10, 30))
                // 10:15 would run to 10:45 and collide, so it goes too.
                .doesNotContain(LocalDateTime.of(2026, 9, 7, 10, 15))
                .contains(LocalDateTime.of(2026, 9, 7, 10, 0))
                .contains(LocalDateTime.of(2026, 9, 7, 11, 0));
    }

    @Test
    @DisplayName("half-open intervals let appointments sit exactly back to back")
    void backToBackIsNotAnOverlap() {
        Interval busy = new Interval(
                LocalDateTime.of(2026, 9, 7, 10, 0),
                LocalDateTime.of(2026, 9, 7, 10, 30));

        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 30, NO_FRICTION, List.of(rule(10, 12)), List.of(busy), NOW);

        // 10:30 starts the instant the other ends — allowed with zero buffer.
        assertThat(slots).extracting(Slot::startAt)
                .contains(LocalDateTime.of(2026, 9, 7, 10, 30));
    }

    @Test
    @DisplayName("the provider buffer blocks the slot immediately after a booking")
    void bufferBlocksTheNextSlot() {
        BookingPolicy withBuffer = new BookingPolicy(15, 0, 60);
        // A booking passed as [start, blockEnd) already includes its buffer.
        Interval busy = new Interval(
                LocalDateTime.of(2026, 9, 7, 10, 0),
                LocalDateTime.of(2026, 9, 7, 10, 45));

        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 30, withBuffer, List.of(rule(10, 12)), List.of(busy), NOW);

        assertThat(slots).extracting(Slot::startAt)
                .doesNotContain(LocalDateTime.of(2026, 9, 7, 10, 30))
                .contains(LocalDateTime.of(2026, 9, 7, 10, 45));
    }

    @Test
    @DisplayName("minimum notice hides slots that are too soon")
    void respectsMinimumNotice() {
        BookingPolicy twoHours = new BookingPolicy(0, 120, 60);
        LocalDateTime nineAm = LocalDateTime.of(2026, 9, 7, 9, 0);

        List<Slot> slots = SlotEngine.computeDaySlots(
                MONDAY, 30, twoHours, List.of(rule(9, 13)), List.of(), nineAm);

        assertThat(slots).isNotEmpty();
        assertThat(slots.get(0).startAt()).isEqualTo(LocalDateTime.of(2026, 9, 7, 11, 0));
    }

    @Test
    @DisplayName("nothing is offered beyond the advance-booking horizon")
    void respectsAdvanceHorizon() {
        BookingPolicy sevenDays = new BookingPolicy(0, 0, 7);
        LocalDate tooFar = MONDAY.plusDays(14);

        assertThat(SlotEngine.computeDaySlots(tooFar, 30, sevenDays, List.of(rule(10, 12)), List.of(), NOW))
                .isEmpty();
    }

    @Test
    @DisplayName("past days are never bookable")
    void refusesPastDays() {
        assertThat(SlotEngine.computeDaySlots(
                MONDAY.minusDays(1), 30, NO_FRICTION, List.of(rule(10, 12)), List.of(), NOW))
                .isEmpty();
    }

    @Test
    @DisplayName("a fully booked day yields nothing")
    void fullyBookedDayIsEmpty() {
        Interval allDay = new Interval(
                LocalDateTime.of(2026, 9, 7, 9, 0),
                LocalDateTime.of(2026, 9, 7, 18, 0));

        assertThat(SlotEngine.computeDaySlots(
                MONDAY, 30, NO_FRICTION, List.of(rule(10, 12)), List.of(allDay), NOW))
                .isEmpty();
    }

    @Test
    @DisplayName("firstAvailable skips closed days and finds the next open one")
    void firstAvailableSkipsClosedDays() {
        // Only Wednesdays are worked.
        AvailabilityRule wednesday = new AvailabilityRule(null, DayOfWeek.WEDNESDAY, 600, 720);

        LocalDateTime first = SlotEngine.firstAvailable(
                30, NO_FRICTION, List.of(wednesday), List.of(), NOW, 14);

        assertThat(first).isNotNull();
        assertThat(first.getDayOfWeek()).isEqualTo(DayOfWeek.WEDNESDAY);
        assertThat(first).isEqualTo(LocalDateTime.of(2026, 9, 9, 10, 0));
    }

    @Test
    @DisplayName("firstAvailable returns null when the lookahead finds nothing")
    void firstAvailableCanBeEmpty() {
        assertThat(SlotEngine.firstAvailable(30, NO_FRICTION, List.of(), List.of(), NOW, 14))
                .isNull();
    }

    @Test
    @DisplayName("a zero-length service is never bookable")
    void rejectsZeroDuration() {
        assertThat(SlotEngine.computeDaySlots(MONDAY, 0, NO_FRICTION, List.of(rule(10, 12)), List.of(), NOW))
                .isEmpty();
    }
}
