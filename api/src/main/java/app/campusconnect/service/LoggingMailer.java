package app.campusconnect.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Writes the email to the log instead of sending it.
 *
 * This is what runs until an SMTP host is configured, so the verification flow
 * can be tested end to end on a laptop with no email account: sign up, copy the
 * link out of the API console, open it.
 *
 * It refuses to be used in production — see MailConfig. A silent no-op mailer on
 * a live site would mean every new user waiting forever for a link that was
 * never sent, and nothing in the logs saying so.
 */
public class LoggingMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailer.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("""

                ==================== EMAIL (not actually sent) ====================
                To:      {}
                Subject: {}

                {}
                ===================================================================
                """, to, subject, body);
    }

    @Override
    public boolean deliversToInbox() {
        return false;
    }

    @Override
    public String describe() {
        return "console (no email is actually sent)";
    }
}
