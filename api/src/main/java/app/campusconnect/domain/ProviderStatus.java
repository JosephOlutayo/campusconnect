package app.campusconnect.domain;

public enum ProviderStatus {
    /** Live and bookable. */
    ACTIVE,
    /** Hidden by the provider themselves. */
    PAUSED,
    /** Awaiting admin approval (when auto-approve is off). */
    PENDING,
    REJECTED,
    /** Hidden by an admin. */
    SUSPENDED
}
