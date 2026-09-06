package app.campusconnect.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;

/**
 * Accepts the connection string hosting platforms actually hand out.
 *
 * Fly, Heroku and Railway all set DATABASE_URL to a URI of the form
 * {@code postgres://user:password@host:5432/dbname}. JDBC cannot read that —
 * it wants {@code jdbc:postgresql://host:5432/dbname} with the credentials
 * supplied separately — so attaching a database and starting the app fails with
 * a driver error that says nothing about the real cause.
 *
 * This runs before the DataSource is built and, when DATABASE_URL is that kind
 * of URI, splits it into the three properties Spring expects. A DATABASE_URL
 * that is already a jdbc: URL is left alone.
 */
public class DatabaseUrlNormalizer implements EnvironmentPostProcessor {

    private static final String SOURCE_NAME = "database-url-normalizer";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String raw = environment.getProperty("DATABASE_URL");
        if (raw == null) {
            raw = System.getenv("DATABASE_URL");
        }
        if (raw == null || raw.isBlank()) {
            return;
        }
        raw = raw.trim();

        // Already in the shape JDBC wants, or some other scheme entirely.
        if (raw.startsWith("jdbc:")) {
            return;
        }
        if (!raw.startsWith("postgres://") && !raw.startsWith("postgresql://")) {
            return;
        }

        URI uri;
        try {
            uri = new URI(raw);
        } catch (URISyntaxException e) {
            // Leave it be and let the datasource fail with its own message
            // rather than swallowing a value someone meant to be used.
            return;
        }

        String host = uri.getHost();
        if (host == null) {
            return;
        }
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");

        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                .append(host).append(':').append(port).append('/').append(database);
        // sslmode and friends belong on the JDBC URL too.
        if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
            jdbc.append('?').append(uri.getQuery());
        }

        Map<String, Object> resolved = new HashMap<>();
        resolved.put("spring.datasource.url", jdbc.toString());

        String userInfo = uri.getUserInfo();
        if (userInfo != null && !userInfo.isBlank()) {
            int split = userInfo.indexOf(':');
            String user = split < 0 ? userInfo : userInfo.substring(0, split);
            String password = split < 0 ? "" : userInfo.substring(split + 1);
            // Credentials are percent-encoded in a URI; a password containing
            // a '@' or '/' arrives escaped and must be decoded before use.
            resolved.put("spring.datasource.username", decode(user));
            resolved.put("spring.datasource.password", decode(password));
        }

        // Added at the front so it wins over the defaults in application.yml.
        environment.getPropertySources().addFirst(new MapPropertySource(SOURCE_NAME, resolved));
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
