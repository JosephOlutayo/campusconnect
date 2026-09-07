package app.campusconnect.service;

/**
 * Sending an email. Two implementations: one writes the message to the log so
 * the whole flow can be exercised locally with no account anywhere, the other
 * hands it to a real SMTP server.
 *
 * Which one is active is decided by configuration, so no calling code changes
 * when real sending is switched on.
 */
public interface Mailer {

    void send(String to, String subject, String body);

    /**
     * Whether a message sent here actually reaches an inbox.
     *
     * False while the console mailer is in use, which the UI needs to know: a
     * sign-up form that tells people to use their campus email so they can
     * confirm it is lying when nothing is ever delivered.
     */
    boolean deliversToInbox();

    /** Shown in logs and on the admin console so the active setup is never a guess. */
    String describe();
}
