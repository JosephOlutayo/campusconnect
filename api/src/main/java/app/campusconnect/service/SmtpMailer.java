package app.campusconnect.service;

import app.campusconnect.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Real sending, through whatever SMTP host is configured — Resend, Postmark,
 * SES and the rest all speak it.
 *
 * University mail servers are strict. Without SPF and DKIM records for the
 * sending domain, campus addresses are exactly the ones most likely to reject
 * or silently bin these messages, which looks identical to the app being broken.
 */
public class SmtpMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailer.class);

    private final JavaMailSender sender;
    private final String from;

    public SmtpMailer(JavaMailSender sender, String from) {
        this.sender = sender;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        try {
            sender.send(message);
        } catch (MailException ex) {
            // Logged in full here; the caller gets something a person can act on
            // without exposing the mail host's response to the browser.
            log.error("Could not send mail to {}", to, ex);
            throw ApiException.badRequest(
                    "We could not send the email just now. Please try again in a minute.");
        }
    }

    @Override
    public boolean deliversToInbox() {
        return true;
    }

    @Override
    public String describe() {
        return "SMTP as " + from;
    }
}
