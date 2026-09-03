package app.campusconnect.domain;

import java.util.EnumSet;
import java.util.Set;

public enum BookingStatus {
    PENDING,
    CONFIRMED,
    COMPLETED,
    CANCELLED,
    NO_SHOW;

    /**
     * Statuses that occupy a slot on the provider's calendar. Anything in here
     * blocks a competing booking; anything else frees the time back up.
     */
    public static final Set<BookingStatus> BLOCKING = EnumSet.of(PENDING, CONFIRMED);

    public boolean isBlocking() {
        return BLOCKING.contains(this);
    }
}
