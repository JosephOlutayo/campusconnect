package app.campusconnect.seed;

import app.campusconnect.domain.PlatformSetting;
import app.campusconnect.domain.Role;
import app.campusconnect.domain.User;
import app.campusconnect.repository.CategoryRepository;
import app.campusconnect.repository.UniversityRepository;
import app.campusconnect.repository.PlatformSettingRepository;
import app.campusconnect.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Makes an empty database usable.
 *
 * The demo seeder is switched off in production, which left a real deployment
 * with no categories and — more importantly — no administrator. Creating a
 * university requires an admin, signing up requires a university, and promoting
 * someone to admin requires an admin, so a fresh production database was a
 * deadlock: nobody could get in to set anything up.
 *
 * This runs in every profile, after the demo seeder, and only fills in what is
 * genuinely missing. On a database that already has data it does nothing.
 */
@Component
@Order(2) // after DataSeeder, so a dev database is already populated by now
public class BootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapRunner.class);

    /** Short enough to type, long enough not to be guessed in a drive-by. */
    private static final int MIN_ADMIN_PASSWORD_LENGTH = 12;

    private final UserRepository users;
    private final CategoryRepository categories;
    private final UniversityRepository universities;
    private final PlatformSettingRepository settings;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;
    private final String adminName;
    private final int defaultFeePercent;

    public BootstrapRunner(UserRepository users,
                           CategoryRepository categories,
                           UniversityRepository universities,
                           PlatformSettingRepository settings,
                           PasswordEncoder passwordEncoder,
                           @Value("${campusconnect.bootstrap.admin-email:}") String adminEmail,
                           @Value("${campusconnect.bootstrap.admin-password:}") String adminPassword,
                           @Value("${campusconnect.bootstrap.admin-name:Administrator}") String adminName,
                           @Value("${campusconnect.platform-fee-percent:10}") int defaultFeePercent) {
        this.users = users;
        this.categories = categories;
        this.universities = universities;
        this.settings = settings;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail == null ? "" : adminEmail.trim();
        this.adminPassword = adminPassword == null ? "" : adminPassword;
        this.adminName = adminName;
        this.defaultFeePercent = defaultFeePercent;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensureSettings();
        ensureCategories();
        ensureCampuses();
        ensureAdmin();
    }

    /** Without these the admin console reads blank on a fresh database. */
    private void ensureSettings() {
        if (settings.findById(PlatformSetting.PLATFORM_FEE_PERCENT).isEmpty()) {
            settings.save(new PlatformSetting(PlatformSetting.PLATFORM_FEE_PERCENT,
                    String.valueOf(defaultFeePercent)));
            log.info("Bootstrap: platform fee set to {}%.", defaultFeePercent);
        }
        if (settings.findById(PlatformSetting.PROVIDER_AUTO_APPROVE).isEmpty()) {
            settings.save(new PlatformSetting(PlatformSetting.PROVIDER_AUTO_APPROVE, "true"));
        }
    }

    /**
     * Adds any campus from the catalogue that is missing.
     *
     * Deliberately not gated on "are there none yet" the way the categories are.
     * An operator who has already set a campus up should still receive ones
     * added to the catalogue later, and their own edits are safe because
     * existing campuses are matched by slug and left untouched.
     */
    private void ensureCampuses() {
        int added = CampusCatalog.addMissing(universities);
        if (added > 0) {
            log.info("Bootstrap: added {} campus(es) from the catalogue. "
                    + "Edit, hide or extend them in the admin console.", added);
        }
    }

    private void ensureCategories() {
        if (categories.count() > 0) {
            return;
        }
        ServiceCatalog.createAll(categories);
        log.info("Bootstrap: created {} service categories. Edit them in the admin console.",
                ServiceCatalog.size());
    }

    /**
     * The first administrator, from configuration. Deliberately never given a
     * default password: an admin account with a known password on a public URL
     * is the whole platform compromised.
     */
    private void ensureAdmin() {
        if (users.countByRole(Role.ADMIN) > 0) {
            return;
        }
        if (adminEmail.isBlank() || adminPassword.isBlank()) {
            log.warn("""

                    ------------------------------------------------------------------
                    No administrator exists and none is configured, so this deployment
                    cannot be set up: creating a university needs an admin, and signing
                    up needs a university.

                    Set these and restart:
                      ADMIN_EMAIL=you@yourdomain.com
                      ADMIN_PASSWORD=<at least {} characters>

                    Then sign in and add your universities and their email domains
                    under Admin -> Universities.
                    ------------------------------------------------------------------
                    """, MIN_ADMIN_PASSWORD_LENGTH);
            return;
        }
        if (adminPassword.length() < MIN_ADMIN_PASSWORD_LENGTH) {
            throw new IllegalStateException(
                    "ADMIN_PASSWORD is shorter than " + MIN_ADMIN_PASSWORD_LENGTH
                            + " characters. This account can see and change everything on the "
                            + "platform; give it a real password.");
        }
        if (users.existsByEmailIgnoreCase(adminEmail)) {
            log.warn("Bootstrap: {} already exists but is not an admin. Leaving it alone.", adminEmail);
            return;
        }

        // No university: an administrator runs the platform rather than belonging
        // to one campus, and the column is nullable for exactly this reason.
        User admin = new User(adminEmail.toLowerCase(),
                passwordEncoder.encode(adminPassword),
                adminName,
                Role.ADMIN,
                "admin-" + UUID.randomUUID().toString().substring(0, 6),
                null);
        admin.setEmailVerifiedAt(Instant.now());
        users.save(admin);

        log.info("Bootstrap: created the first administrator, {}. Sign in and add your universities.",
                adminEmail);
    }
}
