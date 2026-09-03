package app.campusconnect.service;

import app.campusconnect.domain.ProviderProfile;

/**
 * The subset of a provider's settings the slot engine needs. Extracted as a
 * record so the engine can be exercised without building a whole JPA graph.
 */
public record BookingPolicy(int bufferMinutes, int minNoticeMinutes, int maxAdvanceDays) {

    public static BookingPolicy from(ProviderProfile provider) {
        return new BookingPolicy(
                provider.getBufferMinutes(),
                provider.getMinNoticeMinutes(),
                provider.getMaxAdvanceDays());
    }
}
