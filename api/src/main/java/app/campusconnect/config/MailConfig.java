package app.campusconnect.config;

import app.campusconnect.service.LoggingMailer;
import app.campusconnect.service.Mailer;
import app.campusconnect.service.SmtpMailer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Arrays;

/**
 * Picks the mailer. Configured host wins; otherwise the console one.
 */
@Configuration
public class MailConfig {

    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    @Bean
    public Mailer mailer(JavaMailSender sender,
                         Environment environment,
                         @Value("${spring.mail.host:}") String host,
                         @Value("${campusconnect.mail.from:CampusConnect <no-reply@localhost>}") String from) {

        boolean smtpConfigured = host != null && !host.isBlank();
        boolean isProduction = Arrays.asList(environment.getActiveProfiles()).contains("prod");

        if (isProduction && !smtpConfigured) {
            // In production the console mailer would mean every new account waits
            // for a link that never arrives, and the only trace is a log line
            // nobody is reading. Better to refuse to start.
            throw new IllegalStateException("""

                    REFUSING TO START: the production profile is active but no mail host is
                    configured, so verification emails could never be delivered. Students
                    would wait forever for a link that was never sent.

                    Set these (values from Resend, Postmark, SES or similar):
                      MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD
                      MAIL_FROM='CampusConnect <no-reply@yourdomain.com>'

                    Add SPF and DKIM records for that domain too, or university mail
                    servers will reject the messages.
                    """);
        }

        if (smtpConfigured) {
            log.info("Mail: sending over SMTP via {} as {}", host, from);
            return new SmtpMailer(sender, from);
        }

        log.warn("Mail: no MAIL_HOST set — verification links will be printed to this log, not emailed.");
        return new LoggingMailer();
    }
}
