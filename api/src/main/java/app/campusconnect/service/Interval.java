package app.campusconnect.service;

import java.time.LocalDateTime;

/**
 * A half-open time range [start, end).
 *
 * Half-open is the whole trick behind clean scheduling: an appointment ending at
 * 17:00 and one starting at 17:00 do not overlap, so no off-by-one minute fudging
 * is needed anywhere.
 */
public record Interval(LocalDateTime start, LocalDateTime end) {

    public boolean overlaps(Interval other) {
        return start.isBefore(other.end) && end.isAfter(other.start);
    }

    public boolean overlaps(LocalDateTime otherStart, LocalDateTime otherEnd) {
        return start.isBefore(otherEnd) && end.isAfter(otherStart);
    }
}
