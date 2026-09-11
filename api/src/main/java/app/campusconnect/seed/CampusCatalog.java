package app.campusconnect.seed;

import app.campusconnect.domain.University;
import app.campusconnect.repository.UniversityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * The Texas campuses a deployment starts with.
 *
 * Adding a university is otherwise an admin typing seven fields correctly, and
 * nobody can sign up until at least one exists — so the common ones ship with
 * the application rather than being somebody's first chore.
 *
 * Unlike the category catalogue, this one is applied on every startup and adds
 * only what is missing, keyed by slug. That matters because an operator will
 * have edited these: renamed a campus, added an email domain, hidden one they
 * do not serve. Existing rows are never touched, so those edits survive a
 * deploy.
 *
 * The slugs and domains deliberately match {@link DataSeeder}'s, so a developer
 * database seeded with demo data and a production database built from this list
 * describe the same campuses rather than two overlapping sets.
 */
final class CampusCatalog {

    private static final Logger log = LoggerFactory.getLogger(CampusCatalog.class);

    private CampusCatalog() {
    }

    /**
     * name, short name, slug, city, state, latitude, longitude, colour,
     * comma-separated email domains.
     *
     * Coordinates are the middle of each campus, accurate enough for the
     * "how far away is this provider" figure and nothing more precise. Colours
     * are each school's own, so the campus cards are told apart at a glance.
     *
     * Domains are the primary student address for each school. They are what
     * grants the campus-verified badge, so only addresses we are confident
     * about are listed — an operator can add more (a student subdomain, say)
     * under Admin -> Universities without touching this file.
     */
    private static final Object[][] ROWS = {
            {"The University of Texas at Dallas", "UTD", "ut-dallas", "Richardson", "TX",
                    32.9857, -96.7502, "#E87500", "utdallas.edu,utd.edu"},
            {"The University of Texas at Austin", "UT", "ut-austin", "Austin", "TX",
                    30.2849, -97.7341, "#BF5700", "utexas.edu"},
            {"Texas A&M University", "TAMU", "texas-am", "College Station", "TX",
                    30.6150, -96.3414, "#500000", "tamu.edu"},
            {"Texas Tech University", "TTU", "texas-tech", "Lubbock", "TX",
                    33.5843, -101.8783, "#CC0000", "ttu.edu"},
            {"University of Houston", "UH", "houston", "Houston", "TX",
                    29.7199, -95.3422, "#C8102E", "uh.edu"},
            {"Texas State University", "TXST", "texas-state", "San Marcos", "TX",
                    29.8884, -97.9384, "#501214", "txstate.edu"},
            {"University of North Texas", "UNT", "north-texas", "Denton", "TX",
                    33.2075, -97.1526, "#00853E", "unt.edu,my.unt.edu"},
            {"Rice University", "Rice", "rice", "Houston", "TX",
                    29.7174, -95.4018, "#00205B", "rice.edu"},
            {"Southern Methodist University", "SMU", "smu", "Dallas", "TX",
                    32.8412, -96.7845, "#354CA1", "smu.edu"},
            {"The University of Texas at Arlington", "UTA", "ut-arlington", "Arlington", "TX",
                    32.7317, -97.1148, "#0064B1", "uta.edu,mavs.uta.edu"},
    };

    static int size() {
        return ROWS.length;
    }

    /**
     * Creates any campus that is not already present.
     *
     * @return how many were added
     */
    static int addMissing(UniversityRepository universities) {
        int added = 0;

        for (Object[] row : ROWS) {
            String slug = (String) row[2];
            if (universities.existsBySlug(slug)) {
                continue; // already there, and possibly edited — leave it alone
            }

            // An email domain is unique across the whole platform, because it is
            // what decides which campus an address belongs to. If one is already
            // claimed, drop just that domain rather than letting a constraint
            // violation stop the application from starting.
            Set<String> domains = new LinkedHashSet<>();
            for (String domain : ((String) row[8]).split(",")) {
                String clean = domain.trim().toLowerCase();
                if (clean.isEmpty()) {
                    continue;
                }
                if (universities.findByEmailDomain(clean).isPresent()) {
                    log.warn("Campus catalogue: {} is already assigned to another campus, "
                            + "so it was not added to {}.", clean, slug);
                    continue;
                }
                domains.add(clean);
            }

            universities.save(new University(
                    (String) row[0], (String) row[1], slug, (String) row[3], (String) row[4],
                    (Double) row[5], (Double) row[6], (String) row[7], domains));
            added++;
        }

        return added;
    }
}
