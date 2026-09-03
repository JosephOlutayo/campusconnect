package app.campusconnect.domain;

public enum LocationMode {
    /** The student travels to the provider. */
    AT_PROVIDER("You go to them"),
    /** The provider travels to the student. */
    AT_CUSTOMER("They come to you"),
    ONLINE("Online");

    private final String label;

    LocationMode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
