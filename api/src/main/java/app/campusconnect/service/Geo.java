package app.campusconnect.service;

public final class Geo {

    private static final double EARTH_RADIUS_MILES = 3958.8;

    private Geo() {
    }

    /** Haversine great-circle distance in miles. */
    public static double distanceMiles(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.pow(Math.sin(dLon / 2), 2)
                * Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2));
        return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /**
     * Blurs a real position by roughly a third of a mile.
     *
     * A provider's exact coordinates never reach a browser; the public map pin
     * and every distance figure are computed from this jittered point instead.
     * Deterministic in the seed so a provider does not appear to move between
     * page loads.
     */
    public static double[] approximate(double latitude, double longitude, String seed) {
        int hash = 0;
        for (int i = 0; i < seed.length(); i++) {
            hash = hash * 31 + seed.charAt(i);
        }
        double offsetLat = ((Math.abs(hash % 100) / 100.0) - 0.5) * 0.008;
        double offsetLon = ((Math.abs((hash >> 7) % 100) / 100.0) - 0.5) * 0.008;
        return new double[]{latitude + offsetLat, longitude + offsetLon};
    }
}
