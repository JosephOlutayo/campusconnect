package app.campusconnect.web.dto;

import java.util.List;

/** Read models for the dashboard and campus screens. */
public final class StatsDtos {

    private StatsDtos() {
    }

    /** One bar in the hero chart. */
    public record CategoryCount(String name, String icon, long count) {
    }

    /**
     * Everything the home page and a campus page need above the fold:
     * headline counts plus this month's booking activity per category.
     */
    public record CampusOverview(long providerCount, long serviceCount, double averageRating,
                                 long newProvidersThisWeek, long bookingsThisMonth,
                                 List<CategoryCount> topCategories) {
    }

    /** The signed-in student's own numbers. */
    public record MeSummary(long completedBookings, long upcomingBookings, long reviewsWritten,
                            long savedProviders, long spentCents,
                            long unreadMessages, long unreadNotifications,
                            long pendingProviderRequests) {
    }
}
