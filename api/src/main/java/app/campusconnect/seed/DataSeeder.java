package app.campusconnect.seed;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.service.Money;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Demo data.
 *
 * Everything here is fictional. The goal is a database that feels like a
 * marketplace three months after launch: uneven ratings, providers with no
 * reviews yet, real gaps in calendars, a couple of open moderation reports, and
 * enough completed history for the analytics screens to plot something.
 *
 * Runs only when the database is empty, or when started with --seed=reset.
 */
@Order(1) // before BootstrapRunner, which only fills in what this leaves out
@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String PASSWORD = "password123";
    private static final double FEE_PERCENT = 10;

    /** Deterministic RNG so a reseed produces the same demo every time. */
    private final Random random = new Random(1337);

    private final UniversityRepository universities;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final ProviderProfileRepository providers;
    private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules;
    private final PortfolioImageRepository portfolio;
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final ReviewRepository reviews;
    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final FavoriteRepository favorites;
    private final NotificationRepository notifications;
    private final ReportRepository reports;
    private final PromotionRepository promotions;
    private final TimeOffRepository timeOff;
    private final PlatformSettingRepository settings;
    private final PasswordEncoder passwordEncoder;
    private final boolean seedEnabled;

    public DataSeeder(UniversityRepository universities, CategoryRepository categories,
                      UserRepository users, ProviderProfileRepository providers,
                      ServiceOfferingRepository services, AvailabilityRuleRepository rules,
                      PortfolioImageRepository portfolio, BookingRepository bookings,
                      PaymentRepository payments, ReviewRepository reviews,
                      ConversationRepository conversations, MessageRepository messages,
                      FavoriteRepository favorites, NotificationRepository notifications,
                      ReportRepository reports, PromotionRepository promotions,
                      TimeOffRepository timeOff, PlatformSettingRepository settings,
                      PasswordEncoder passwordEncoder,
                      @Value("${campusconnect.seed:true}") boolean seedEnabled) {
        this.universities = universities;
        this.categories = categories;
        this.users = users;
        this.providers = providers;
        this.services = services;
        this.rules = rules;
        this.portfolio = portfolio;
        this.bookings = bookings;
        this.payments = payments;
        this.reviews = reviews;
        this.conversations = conversations;
        this.messages = messages;
        this.favorites = favorites;
        this.notifications = notifications;
        this.reports = reports;
        this.promotions = promotions;
        this.timeOff = timeOff;
        this.settings = settings;
        this.passwordEncoder = passwordEncoder;
        this.seedEnabled = seedEnabled;
    }

    // --- small helpers -------------------------------------------------------

    private <T> T pick(List<T> items) {
        return items.get(random.nextInt(items.size()));
    }

    private int between(int min, int max) {
        return min + random.nextInt(max - min + 1);
    }

    private String bookingCode() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder builder = new StringBuilder("CC-");
        for (int i = 0; i < 6; i++) {
            builder.append(alphabet.charAt(random.nextInt(alphabet.length())));
        }
        return builder.toString();
    }

    private record ProviderSpec(String person, String business, String email, String tagline,
                                String bio, String universitySlug, String locationLabel,
                                String exactAddress, Set<LocationMode> modes, boolean verified,
                                double targetRating, int reviewTarget, int buffer,
                                boolean autoConfirm, int[][] hours, ServiceSpec[] services) {
    }

    private record ServiceSpec(String title, String description, String category,
                               int priceDollars, int minutes) {
    }

    // Weekday, startHour, endHour
    private static final int[][] EVENINGS = {{1, 16, 21}, {2, 16, 21}, {3, 16, 21}, {4, 16, 21}, {5, 15, 22}, {6, 11, 20}};
    private static final int[][] WEEKEND_HEAVY = {{7, 12, 19}, {4, 15, 21}, {5, 10, 20}, {6, 9, 20}};
    private static final int[][] NINE_TO_SIX = {{1, 10, 18}, {2, 10, 18}, {3, 10, 18}, {4, 10, 18}, {5, 10, 18}};

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean reset = args.getOptionValues("seed") != null
                && args.getOptionValues("seed").contains("reset");

        if (!seedEnabled) {
            return;
        }
        if (universities.count() > 0 && !reset) {
            log.info("Database already seeded ({} universities). Start with --seed=reset to rebuild.",
                    universities.count());
            return;
        }
        if (reset) {
            log.info("Clearing existing data…");
            wipe();
        }

        log.info("Seeding CampusConnect demo data…");

        settings.save(new PlatformSetting(PlatformSetting.PLATFORM_FEE_PERCENT, String.valueOf((int) FEE_PERCENT)));
        settings.save(new PlatformSetting(PlatformSetting.PROVIDER_AUTO_APPROVE, "true"));

        Map<String, University> uni = seedUniversities();
        Map<String, Category> cats = seedCategories();
        User admin = seedAdmin(uni.get("ut-dallas"));
        List<User> students = seedStudents(uni);
        List<ProviderProfile> built = seedProviders(uni, cats);

        seedHistoryAndReviews(built, students);
        seedUpcoming(built, students);
        seedDemoAccountActivity(built, students);
        seedExtras(built, students);

        log.info("""

                Seed complete: {} universities, {} categories, {} users, {} providers, {} services, {} bookings, {} reviews

                Demo accounts (password: {})
                  student@campusconnect.dev   student with bookings, saves and messages
                  marcus@utdallas.edu         provider (Campus Cuts)
                  tia@utdallas.edu            provider with manual booking approval
                  admin@campusconnect.dev     admin console
                """,
                universities.count(), categories.count(), users.count(), providers.count(),
                services.count(), bookings.count(), reviews.count(), PASSWORD);
        log.debug("Seeded admin id {}", admin.getId());
    }

    private void wipe() {
        reviews.deleteAll();
        messages.deleteAll();
        conversations.deleteAll();
        payments.deleteAll();
        bookings.deleteAll();
        promotions.deleteAll();
        portfolio.deleteAll();
        rules.deleteAll();
        timeOff.deleteAll();
        services.deleteAll();
        favorites.deleteAll();
        notifications.deleteAll();
        reports.deleteAll();
        providers.deleteAll();
        users.deleteAll();
        universities.deleteAll();
        categories.deleteAll();
        settings.deleteAll();
    }

    private Map<String, University> seedUniversities() {
        Object[][] rows = {
                {"The University of Texas at Dallas", "UT Dallas", "ut-dallas", "Richardson", "TX", 32.9857, -96.7502, "#E87500", "utdallas.edu,utd.edu"},
                {"The University of Texas at Arlington", "UT Arlington", "ut-arlington", "Arlington", "TX", 32.7317, -97.1148, "#0064B1", "uta.edu,mavs.uta.edu"},
                {"University of North Texas", "UNT", "north-texas", "Denton", "TX", 33.2075, -97.1526, "#00853E", "unt.edu,my.unt.edu"},
                {"Texas A&M University", "Texas A&M", "texas-am", "College Station", "TX", 30.6150, -96.3414, "#500000", "tamu.edu"},
                {"The University of Texas at Austin", "UT Austin", "ut-austin", "Austin", "TX", 30.2849, -97.7341, "#BF5700", "utexas.edu"},
                {"Texas Tech University", "Texas Tech", "texas-tech", "Lubbock", "TX", 33.5843, -101.8783, "#CC0000", "ttu.edu"},
        };
        Map<String, University> map = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Set<String> domains = new LinkedHashSet<>(Arrays.asList(((String) row[8]).split(",")));
            University university = universities.save(new University((String) row[0], (String) row[1],
                    (String) row[2], (String) row[3], (String) row[4],
                    (Double) row[5], (Double) row[6], (String) row[7], domains));
            map.put(university.getSlug(), university);
        }
        return map;
    }

    private Map<String, Category> seedCategories() {
        // Shared with BootstrapRunner so demo and production agree.
        return ServiceCatalog.createAll(categories);
    }

    private User newUser(String email, String name, Role role, University university, boolean verified) {
        User user = new User(email, passwordEncoder.encode(PASSWORD), name, role,
                name.toLowerCase().replaceAll("\\s+", "-") + "-seed", university);
        user.setEmailVerifiedAt(Instant.now());
        if (verified) {
            user.setStudentVerifiedAt(Instant.now());
        }
        return users.save(user);
    }

    private User seedAdmin(University university) {
        return newUser("admin@campusconnect.dev", "Alex Rivera", Role.ADMIN, university, false);
    }

    private List<User> seedStudents(Map<String, University> uni) {
        String[][] rows = {
                {"student@campusconnect.dev", "Maya Thompson", "ut-dallas"},
                {"jordan@utdallas.edu", "Jordan Reyes", "ut-dallas"},
                {"amara@utdallas.edu", "Amara Okafor", "ut-dallas"},
                {"chris@utdallas.edu", "Chris Bautista", "ut-dallas"},
                {"hana@utdallas.edu", "Hana Sato", "ut-dallas"},
                {"malik@utdallas.edu", "Malik Freeman", "ut-dallas"},
                {"nia@utdallas.edu", "Nia Washington", "ut-dallas"},
                {"elena@utexas.edu", "Elena Duarte", "ut-austin"},
                {"sam@uta.edu", "Sam Whitaker", "ut-arlington"},
                {"riya@unt.edu", "Riya Patel", "north-texas"},
                {"tomas@tamu.edu", "Tomas Herrera", "texas-am"},
                {"bree@ttu.edu", "Bree Coleman", "texas-tech"},
        };
        List<User> list = new ArrayList<>();
        for (String[] row : rows) {
            list.add(newUser(row[0], row[1], Role.STUDENT, uni.get(row[2]), row[0].endsWith(".edu")));
        }
        return list;
    }

    private List<ProviderProfile> seedProviders(Map<String, University> uni, Map<String, Category> cats) {
        List<ProviderSpec> specs = ProviderCatalog.all();
        List<ProviderProfile> built = new ArrayList<>();

        for (ProviderSpec spec : specs) {
            University university = uni.get(spec.universitySlug());
            User owner = newUser(spec.email(), spec.person(), Role.PROVIDER, university, true);

            // Scatter providers realistically around their campus centre.
            double latitude = university.getLatitude() + (random.nextDouble() - 0.5) * 0.05;
            double longitude = university.getLongitude() + (random.nextDouble() - 0.5) * 0.05;

            ProviderProfile profile = new ProviderProfile(owner, spec.business(), spec.bio(),
                    university, spec.locationLabel(), latitude, longitude);
            profile.setTagline(spec.tagline());
            profile.setExactAddress(spec.exactAddress());
            profile.setLocationModes(new LinkedHashSet<>(spec.modes()));
            profile.setVerified(spec.verified());
            profile.setAutoConfirmBookings(spec.autoConfirm());
            profile.setBufferMinutes(spec.buffer());
            profile.setStatus(ProviderStatus.ACTIVE);
            // Backdate so "new this week" means something — without this every
            // seeded provider looks like it joined today.
            profile.setCreatedAt(Instant.now().minus(between(6, 200), ChronoUnit.DAYS));
            profile = providers.save(profile);

            for (ServiceSpec serviceSpec : spec.services()) {
                ServiceOffering service = new ServiceOffering(profile, cats.get(serviceSpec.category()),
                        serviceSpec.title(), serviceSpec.description(),
                        serviceSpec.priceDollars() * 100, serviceSpec.minutes(),
                        new LinkedHashSet<>(spec.modes()));
                service.setBookingCount(between(0, 40));
                services.save(service);
            }

            for (int[] window : spec.hours()) {
                rules.save(new AvailabilityRule(profile, DayOfWeek.of(window[0]),
                        window[1] * 60, window[2] * 60));
            }

            int shots = between(4, 8);
            for (int i = 0; i < shots; i++) {
                portfolio.save(new PortfolioImage(profile,
                        profile.getUser().getAvatarSeed() + "-work-" + i,
                        i == 0 ? spec.services()[0].title() : null, i));
            }

            built.add(profile);
        }
        return built;
    }

    private Booking saveBooking(ProviderProfile provider, User customer, ServiceOffering service,
                                LocalDateTime start, BookingStatus status) {
        LocalDateTime end = start.plusMinutes(service.getDurationMinutes());
        LocalDateTime blockEnd = end.plusMinutes(provider.getBufferMinutes());
        Money.FeeSplit split = Money.split(service.getPriceCents(), FEE_PERCENT);

        Booking booking = new Booking(bookingCode(), customer, provider, service,
                start, end, blockEnd, status,
                split.totalCents(), split.platformFeeCents(), split.providerPayoutCents(),
                provider.getLocationModes().iterator().next(), provider.getLocationLabel(), null);

        if (status == BookingStatus.CONFIRMED || status == BookingStatus.COMPLETED) {
            booking.setConfirmedAt(Instant.now());
        }
        if (status == BookingStatus.COMPLETED) {
            booking.setCompletedAt(Instant.now());
        }
        booking = bookings.save(booking);

        Payment payment = new Payment(booking, split.totalCents(), split.platformFeeCents(),
                split.providerPayoutCents(), "MOCK", "mock_pi_seed_" + booking.getCode());
        if (status == BookingStatus.COMPLETED) {
            payment.setStatus(PaymentStatus.SUCCEEDED);
            payment.setCapturedAt(Instant.now());
        }
        payments.save(payment);

        return booking;
    }

    private void seedHistoryAndReviews(List<ProviderProfile> built, List<User> students) {
        List<String> high = List.of(
                "Genuinely the best on campus. Booked again before I even left.",
                "On time, professional, and the result was exactly what I asked for.",
                "Worth every dollar. I have already sent three friends.",
                "Super easy to book and the quality speaks for itself.",
                "Made me feel comfortable the whole time and the work is clean.",
                "Fast, friendly, and did not rush the details.",
                "Took the time to actually listen to what I wanted.",
                "Ten out of ten. My go-to from now on.");
        List<String> mid = List.of(
                "Good work overall, ran a little behind schedule.",
                "Happy with the result, would have liked more time on the details.",
                "Solid and fair for the price. Would book again.");
        List<String> low = List.of(
                "Result was fine but I waited almost thirty minutes past my slot.",
                "Not quite what I asked for, though they were polite about it.");

        for (ProviderProfile provider : built) {
            List<ServiceOffering> providerServices =
                    services.findByProviderIdOrderByPriceCentsAsc(provider.getId());
            if (providerServices.isEmpty()) {
                continue;
            }
            int target = Math.max(3, providerServices.size() * 3);

            for (int i = 0; i < target; i++) {
                ServiceOffering service = pick(providerServices);
                User customer = pick(students);
                if (customer.getId().equals(provider.getUser().getId())) {
                    continue;
                }

                LocalDateTime start = LocalDate.now().minusDays(between(3, 120))
                        .atTime(LocalTime.of(between(10, 18), pick(List.of(0, 15, 30, 45))));
                Booking booking = saveBooking(provider, customer, service, start, BookingStatus.COMPLETED);

                // Not everyone reviews — about a fifth stay quiet, like real life.
                if (random.nextDouble() < 0.2) {
                    continue;
                }

                double roll = random.nextDouble();
                int targetRounded = (int) Math.round(provider.isVerified() ? 4.8 : 4.5);
                int rating = roll < 0.72 ? Math.min(5, targetRounded)
                        : roll < 0.92 ? Math.max(3, targetRounded - 1)
                        : Math.max(2, targetRounded - 2);

                String body = rating >= 5 ? pick(high) : rating == 4 ? pick(mid) : pick(low);
                Review review = new Review(booking, provider, customer, rating, body);
                if (rating <= 3 && random.nextDouble() > 0.4) {
                    review.setProviderResponse(
                            "Thank you for the honest feedback — I have adjusted my buffer times.");
                    review.setProviderRespondedAt(Instant.now());
                } else if (random.nextDouble() > 0.75) {
                    review.setProviderResponse("Appreciate you! See you next time.");
                    review.setProviderRespondedAt(Instant.now());
                }
                reviews.save(review);
            }

            double average = reviews.averageVisibleRating(provider.getId());
            long count = reviews.countByProviderIdAndHiddenFalse(provider.getId());
            provider.setRatingAvg(Math.round(average * 100.0) / 100.0);
            provider.setRatingCount((int) count);
            provider.setCompletedBookings(
                    (int) bookings.countByProviderIdAndStatus(provider.getId(), BookingStatus.COMPLETED));
            providers.save(provider);
        }
    }

    /**
     * Upcoming bookings are placed inside each provider's real working windows
     * and tracked so two demo bookings never collide — the same rule the live
     * booking engine enforces.
     */
    private void seedUpcoming(List<ProviderProfile> built, List<User> students) {
        for (ProviderProfile provider : built) {
            List<ServiceOffering> providerServices =
                    services.findByProviderIdOrderByPriceCentsAsc(provider.getId());
            List<AvailabilityRule> providerRules =
                    rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(provider.getId());
            if (providerServices.isEmpty() || providerRules.isEmpty()) {
                continue;
            }

            List<long[]> taken = new ArrayList<>();
            int wanted = between(1, 4);

            for (int i = 0; i < wanted; i++) {
                AvailabilityRule rule = pick(providerRules);
                ServiceOffering service = pick(providerServices);

                LocalDate day = null;
                for (int offset = 1; offset <= 13; offset++) {
                    LocalDate candidate = LocalDate.now().plusDays(offset);
                    if (candidate.getDayOfWeek() == rule.getDayOfWeek()) {
                        day = candidate;
                        break;
                    }
                }
                if (day == null) {
                    continue;
                }

                int latestStart = rule.getEndMinute() - service.getDurationMinutes();
                if (latestStart <= rule.getStartMinute()) {
                    continue;
                }
                int minute = rule.getStartMinute()
                        + random.nextInt(Math.max(1, latestStart - rule.getStartMinute()));
                minute = (minute / 15) * 15;

                LocalDateTime start = day.atStartOfDay().plusMinutes(minute);
                LocalDateTime blockEnd = start.plusMinutes(
                        service.getDurationMinutes() + provider.getBufferMinutes());

                long startMillis = start.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
                long endMillis = blockEnd.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
                boolean clash = taken.stream().anyMatch(range -> startMillis < range[1] && endMillis > range[0]);
                if (clash) {
                    continue;
                }
                taken.add(new long[]{startMillis, endMillis});

                User customer = pick(students);
                if (customer.getId().equals(provider.getUser().getId())) {
                    continue;
                }
                BookingStatus status = provider.isAutoConfirmBookings()
                        ? BookingStatus.CONFIRMED
                        : (random.nextBoolean() ? BookingStatus.PENDING : BookingStatus.CONFIRMED);
                saveBooking(provider, customer, service, start, status);
            }
        }
    }

    /** Gives the demo student account something to look at on first login. */
    private void seedDemoAccountActivity(List<ProviderProfile> built, List<User> students) {
        User maya = users.findByEmailIgnoreCase("student@campusconnect.dev").orElseThrow();
        ProviderProfile marcus = byName(built, "Campus Cuts");
        ProviderProfile tia = byName(built, "Braids by Tia");
        ProviderProfile priya = byName(built, "UTD Tutoring Collective");
        ProviderProfile jasmine = byName(built, "Nails by Jasmine");

        // A completed booking with no review yet, so the review flow is
        // reachable the moment you sign in.
        ServiceOffering nailService = services.findByProviderIdOrderByPriceCentsAsc(jasmine.getId()).get(0);
        Booking pastBooking = saveBooking(jasmine, maya, nailService,
                LocalDate.now().minusDays(4).atTime(15, 0), BookingStatus.COMPLETED);
        log.debug("Demo unreviewed booking {}", pastBooking.getCode());

        favorites.save(new Favorite(maya, marcus));
        favorites.save(new Favorite(maya, tia));
        favorites.save(new Favorite(maya, priya));

        Conversation withMarcus = conversations.save(new Conversation(maya, marcus));
        Message asked = new Message(withMarcus, maya, "Hey! Do you have anything Thursday evening for a cut?");
        asked.setReadAt(Instant.now());
        messages.save(asked);
        messages.save(new Message(withMarcus, marcus.getUser(),
                "Thursday after 5 is open — grab whatever slot works on my calendar and I will confirm it."));

        Conversation withPriya = conversations.save(new Conversation(maya, priya));
        messages.save(new Message(withPriya, priya.getUser(),
                "I am running a group Calc II review before the midterm if you want in — same rate, split three ways."));

        notifications.save(new Notification(maya, NotificationType.MESSAGE_RECEIVED,
                "Message from Campus Cuts",
                "Thursday after 5 is open — grab whatever slot works on my calendar.",
                "/messages/" + withMarcus.getId()));
        notifications.save(new Notification(maya, NotificationType.BOOKING_COMPLETED,
                "How did it go?", "Leave Nails by Jasmine a review — it takes 20 seconds.",
                "/appointments/" + pastBooking.getId() + "?review=1"));
    }

    private void seedExtras(List<ProviderProfile> built, List<User> students) {
        ProviderProfile marcus = byName(built, "Campus Cuts");
        ProviderProfile tia = byName(built, "Braids by Tia");
        ProviderProfile denton = byName(built, "Mean Green Nails");

        promotions.save(new Promotion(denton, "FIRST10", "10% off your first set",
                DiscountType.PERCENT, 10,
                LocalDateTime.now().minusDays(30), LocalDateTime.now().plusDays(60), null));
        promotions.save(new Promotion(marcus, "SYLLABUS", "$5 off during the first week of term",
                DiscountType.AMOUNT, 500,
                LocalDateTime.now().minusDays(5), LocalDateTime.now().plusDays(25), 50));

        timeOff.save(new TimeOff(tia, LocalDate.now().plusDays(5).atStartOfDay(),
                LocalDate.now().plusDays(7).atTime(23, 0), "Out of town"));
        timeOff.save(new TimeOff(marcus, LocalDate.now().plusDays(2).atTime(18, 0),
                LocalDate.now().plusDays(2).atTime(21, 0), "Class"));

        ProviderProfile reported = built.get(built.size() - 1);
        reports.save(new Report(students.get(1), "PROVIDER", reported.getId(),
                reported.getUser().getId(), "No-show or unprofessional",
                "Booked for Saturday and they never showed up or replied to messages."));

        ProviderProfile second = built.get(10);
        Report reviewing = new Report(students.get(3), "PROVIDER", second.getId(),
                second.getUser().getId(), "Fake listing",
                "The photos on this listing look like they were taken from a salon website.");
        reviewing.setStatus(ReportStatus.REVIEWING);
        reports.save(reviewing);
    }

    private ProviderProfile byName(List<ProviderProfile> built, String businessName) {
        return built.stream()
                .filter(provider -> provider.getBusinessName().equals(businessName))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Seed provider missing: " + businessName));
    }

    /** Provider fixtures, split out so the seeder itself stays readable. */
    static final class ProviderCatalog {

        private ProviderCatalog() {
        }

        private static Set<LocationMode> modes(LocationMode... values) {
            return new LinkedHashSet<>(Arrays.asList(values));
        }

        static List<ProviderSpec> all() {
            List<ProviderSpec> list = new ArrayList<>();

            list.add(new ProviderSpec("Marcus Bell", "Campus Cuts", "marcus@utdallas.edu",
                    "Fades between classes — 10 minutes from the Student Union",
                    "Cutting hair since high school, licensed for two years. I keep a tight schedule so you can get in and out between lectures. Skin fades, tapers, beard work and kids' cuts. I take walk-ins when the calendar shows an opening, but booking ahead is safer around midterms.",
                    "ut-dallas", "Northside Apartments, near UT Dallas",
                    "1200 Rutford Ave, Apt 4B, Richardson, TX 75080",
                    modes(LocationMode.AT_PROVIDER, LocationMode.AT_CUSTOMER), true, 4.9, 84, 5, true, EVENINGS,
                    new ServiceSpec[]{
                            new ServiceSpec("Signature Haircut", "Consultation, cut, line-up and a hot towel finish. The standard cut most people book.", "barbering", 25, 30),
                            new ServiceSpec("Haircut + Beard", "Full cut plus beard shape, line-up and oil. Allow a little extra time.", "barbering", 35, 45),
                            new ServiceSpec("Line-Up Only", "Quick edge-up to hold you over between full cuts.", "barbering", 12, 15)}));

            list.add(new ProviderSpec("Tia Robinson", "Braids by Tia", "tia@utdallas.edu",
                    "Knotless braids that last — protective styling specialist",
                    "Braider of six years specialising in knotless box braids, boho styles and stitch cornrows. Hair is included in every price unless you bring your own. Come with hair washed, blown out and detangled — it saves us both an hour. I play music, you can nap.",
                    "ut-dallas", "Near UT Dallas campus", "800 Waterview Pkwy, Richardson, TX 75080",
                    modes(LocationMode.AT_PROVIDER), true, 4.8, 61, 30, false, WEEKEND_HEAVY,
                    new ServiceSpec[]{
                            new ServiceSpec("Knotless Box Braids (Medium)", "Mid-back length, hair included. Please arrive with hair washed and blown out.", "braiding", 180, 300),
                            new ServiceSpec("Stitch Cornrows (6-8)", "Clean, straight-back stitch braids. Great for the gym or under a wig.", "braiding", 75, 120),
                            new ServiceSpec("Boho Knotless", "Knotless braids with curly ends left out. Bring inspo photos.", "braiding", 220, 360)}));

            list.add(new ProviderSpec("Jasmine Ortiz", "Nails by Jasmine", "jasmine@utdallas.edu",
                    "Gel-x, acrylics and hand-painted sets",
                    "Licensed nail tech working out of a clean home studio five minutes from campus. Structured gel, acrylic full sets, and freehand art. I sanitise everything between clients and use quality product — your sets should last three weeks, not three days.",
                    "ut-dallas", "Waterview area, near UT Dallas", null,
                    modes(LocationMode.AT_PROVIDER), true, 4.7, 47, 15, true,
                    new int[][]{{7, 12, 18}, {2, 14, 20}, {3, 14, 20}, {4, 14, 20}, {5, 11, 20}, {6, 10, 18}},
                    new ServiceSpec[]{
                            new ServiceSpec("Acrylic Full Set", "Full set with your choice of shape and one solid colour.", "nails", 55, 90),
                            new ServiceSpec("Gel-X Full Set", "Lightweight soft gel extensions. Gentler on natural nails.", "nails", 65, 90),
                            new ServiceSpec("Gel Manicure", "Shape, cuticle work and gel polish on natural nails.", "nails", 35, 60)}));

            list.add(new ProviderSpec("Priya Raman", "UTD Tutoring Collective", "priya@utdallas.edu",
                    "Calculus, linear algebra and stats — taught by people who aced them",
                    "I am a senior maths major who has TA'd Calc I and II for three semesters. Sessions are worked-problem heavy: bring your homework, your lecture notes and the questions you got stuck on. I also run group sessions before exams — message me and I will set one up.",
                    "ut-dallas", "McDermott Library / online", null,
                    modes(LocationMode.AT_PROVIDER, LocationMode.ONLINE), true, 5.0, 38, 0, true,
                    new int[][]{{1, 12, 20}, {2, 12, 20}, {3, 12, 20}, {4, 12, 20}, {7, 14, 19}},
                    new ServiceSpec[]{
                            new ServiceSpec("Calculus I & II — 1 hour", "One-on-one problem session. Bring specific questions for the best value.", "tutoring", 30, 60),
                            new ServiceSpec("Linear Algebra — 1 hour", "Proofs, matrices, eigenvalues. Comfortable with both the theory and the exam tricks.", "tutoring", 32, 60),
                            new ServiceSpec("Exam Cram — 2 hours", "Focused review the week before a midterm or final.", "tutoring", 55, 120)}));

            list.add(new ProviderSpec("Devon Clarke", "Campus Lens Photography", "devon@utdallas.edu",
                    "Grad photos, portraits and org events",
                    "Photographer with a documentary lean. Grad shoots on the plinth and around the Trellis Plaza, portraits with natural light, and event coverage for student orgs. Every session includes edited high-res images delivered inside five days, plus web-sized versions for socials.",
                    "ut-dallas", "Anywhere on the UT Dallas campus", null,
                    modes(LocationMode.AT_CUSTOMER), false, 4.9, 29, 30, false,
                    new int[][]{{5, 9, 19}, {6, 8, 19}, {7, 10, 18}, {3, 16, 20}},
                    new ServiceSpec[]{
                            new ServiceSpec("Grad Photo Session", "45 minutes on campus, 2 outfit changes, 25+ edited images.", "photography", 120, 60),
                            new ServiceSpec("Portrait Mini Session", "20 minutes, one look, 10 edited images. Great for LinkedIn or socials.", "photography", 55, 30),
                            new ServiceSpec("Org Event Coverage (2 hr)", "Event photography for student organisations. Gallery within a week.", "photography", 200, 120)}));

            list.add(new ProviderSpec("Andre Willis", "CleanRide Detailing", "andre@utdallas.edu",
                    "Mobile detailing — I come to your parking lot",
                    "I bring water, power and everything else to your space in Lot M or your apartment complex. Interior resets are my speciality: if your car has lived through a semester of drive-thru runs, I can bring it back. Book the full detail if you have not cleaned it since move-in.",
                    "ut-dallas", "Mobile — UT Dallas lots and nearby apartments", null,
                    modes(LocationMode.AT_CUSTOMER), true, 4.6, 33, 30, true,
                    new int[][]{{1, 9, 17}, {3, 9, 17}, {5, 9, 18}, {6, 9, 16}},
                    new ServiceSpec[]{
                            new ServiceSpec("Interior Reset", "Full vacuum, wipe-down, windows, mats shampooed. The one most students book.", "car-care", 70, 90),
                            new ServiceSpec("Exterior Hand Wash", "Two-bucket wash, wheels, tyre shine and spray sealant.", "car-care", 45, 60),
                            new ServiceSpec("Full Detail", "Interior reset plus exterior wash, clay bar and wax. Allow three hours.", "car-care", 150, 180)}));

            list.add(new ProviderSpec("Jayla Foster", "FitWithJay", "jayla@utdallas.edu",
                    "Strength coaching at the Activity Center",
                    "NASM-certified trainer and former college athlete. I coach beginners through their first barbell sessions and help experienced lifters fix the thing that has been stalling them for months. Every client gets a written programme they keep, not just an hour of me counting reps.",
                    "ut-dallas", "Activity Center, UT Dallas", null,
                    modes(LocationMode.AT_PROVIDER, LocationMode.ONLINE), true, 4.9, 41, 0, true,
                    new int[][]{{1, 6, 11}, {2, 6, 11}, {3, 6, 11}, {4, 6, 11}, {5, 7, 12}},
                    new ServiceSpec[]{
                            new ServiceSpec("1-on-1 Training Session", "60 minutes of coached training at the campus gym.", "fitness", 40, 60),
                            new ServiceSpec("Form Check & Programme Build", "We film your main lifts, fix them, and I write you a 6-week programme.", "fitness", 65, 75),
                            new ServiceSpec("Online Check-in (monthly)", "Programme updates and weekly video form review, fully remote.", "fitness", 50, 30)}));

            list.add(new ProviderSpec("Sofia Mendes", "Glam by Sofia", "sofia@utdallas.edu",
                    "Formal glam, soft beats and makeup lessons",
                    "Makeup artist for formals, galas, grad photos and the nights that end up on everyone's story. I work with all skin tones and bring a sanitised kit to you. If you would rather learn to do it yourself, book a lesson and bring your own products — we will work with what you already own.",
                    "ut-dallas", "Travels to you around Richardson", null,
                    modes(LocationMode.AT_CUSTOMER, LocationMode.AT_PROVIDER), false, 4.8, 22, 20, true, WEEKEND_HEAVY,
                    new ServiceSpec[]{
                            new ServiceSpec("Full Glam", "Full face with lashes included. Ideal for formals and galas.", "makeup", 85, 75),
                            new ServiceSpec("Soft Natural Beat", "Everyday-plus look for photos, dates and presentations.", "makeup", 60, 60),
                            new ServiceSpec("Makeup Lesson", "90 minutes using your own products. You do it, I coach.", "makeup", 70, 90)}));

            list.add(new ProviderSpec("Noah Kim", "Kim Creative Studio", "noah@utdallas.edu",
                    "Logos, decks and org branding that does not look like Canva",
                    "Design student and freelancer. I do brand identities for student orgs, pitch decks for competition teams, and flyers that actually get read. Two rounds of revisions included on everything. Files delivered in every format you will need.",
                    "ut-dallas", "Online / campus meetups", null,
                    modes(LocationMode.ONLINE, LocationMode.AT_PROVIDER), false, 4.7, 18, 0, true, NINE_TO_SIX,
                    new ServiceSpec[]{
                            new ServiceSpec("Logo & Brand Kit", "Logo, colour palette, type choices and usage files. Two revision rounds.", "design", 150, 60),
                            new ServiceSpec("Event Flyer", "Print and story-sized versions of one flyer, delivered in 48 hours.", "design", 45, 45),
                            new ServiceSpec("Pitch Deck Polish", "We rebuild your slides so they look like the team you want to be.", "design", 120, 90)}));

            list.add(new ProviderSpec("Leo Vargas", "Ink by Leo", "leo@utdallas.edu",
                    "Fine-line tattoos and flash, by appointment",
                    "Fine-line and small-scale work out of a licensed private studio. Single-use needles, everything sealed and opened in front of you. Bring a reference, or pick from the flash sheets on my profile. Must be 18 with valid ID — no exceptions, do not ask.",
                    "ut-dallas", "Private studio, Richardson", null,
                    modes(LocationMode.AT_PROVIDER), true, 4.9, 23, 30, false,
                    new int[][]{{3, 13, 20}, {4, 13, 20}, {5, 12, 20}, {6, 12, 19}},
                    new ServiceSpec[]{
                            new ServiceSpec("Small Flash Tattoo", "Pre-drawn design under 3 inches. Includes aftercare kit.", "tattoo", 90, 60),
                            new ServiceSpec("Custom Fine-Line (2 hr)", "Custom drawn piece. Free consultation before the session.", "tattoo", 220, 120)}));

            list.add(new ProviderSpec("Ayanna Brooks", "Lash Lounge ATX", "ayanna@utexas.edu",
                    "Classic, hybrid and volume lash sets",
                    "Licensed lash artist near the Drag. Classic sets for a natural look, volume for full drama, and brow shaping to match. Come with a clean face and no eye makeup. Fills are cheaper within three weeks, so book your next one before you leave.",
                    "ut-austin", "Near UT Austin campus", null,
                    modes(LocationMode.AT_PROVIDER), true, 4.9, 52, 15, true, EVENINGS,
                    new ServiceSpec[]{
                            new ServiceSpec("Classic Full Set", "One extension per natural lash. Natural, everyday length.", "lashes-brows", 90, 120),
                            new ServiceSpec("Hybrid Full Set", "Mix of classic and volume fans for texture.", "lashes-brows", 110, 135),
                            new ServiceSpec("Lash Fill (2-3 weeks)", "Top-up on an existing set. Must be at least 40% intact.", "lashes-brows", 55, 75),
                            new ServiceSpec("Brow Shape & Tint", "Wax, tweeze and tint to frame the face.", "lashes-brows", 40, 45)}));

            list.add(new ProviderSpec("Caleb Nguyen", "Longhorn Line Barbers", "caleb@utexas.edu",
                    "Sharp fades on Speedway",
                    "Third-year barber cutting near West Campus. Fades, scissor work, and the kind of line-up that survives a photo. Text me if you are running late — I would rather adjust than rush your cut.",
                    "ut-austin", "West Campus, Austin", null,
                    modes(LocationMode.AT_PROVIDER), false, 4.6, 27, 5, true, EVENINGS,
                    new ServiceSpec[]{
                            new ServiceSpec("Fade & Line-Up", "Skin, low or mid fade with a crisp line-up.", "barbering", 28, 40),
                            new ServiceSpec("Scissor Cut", "For longer hair — shape, texture and thinning as needed.", "barbering", 32, 45)}));

            list.add(new ProviderSpec("Maya Alvarez", "Silk Press by Maya", "maya@uta.edu",
                    "Healthy silk presses and natural hair care",
                    "Natural hair specialist. Silk presses that hold without frying your curls, deep conditioning treatments, and trims that keep your ends alive. I use heat protectant on every pass and never go above 400. Your curl pattern comes back — that is the whole point.",
                    "ut-arlington", "Near UT Arlington campus", null,
                    modes(LocationMode.AT_PROVIDER), true, 4.8, 36, 20, true,
                    new int[][]{{2, 12, 19}, {4, 12, 19}, {5, 10, 18}, {6, 9, 17}},
                    new ServiceSpec[]{
                            new ServiceSpec("Silk Press", "Wash, deep condition, blow out and press. Includes a light trim.", "hair-styling", 85, 150),
                            new ServiceSpec("Deep Conditioning Treatment", "Steam treatment and protein/moisture balance for stressed hair.", "hair-styling", 45, 60),
                            new ServiceSpec("Wash & Twist Out", "Cleanse, condition and set for a defined twist out.", "hair-styling", 60, 105)}));

            list.add(new ProviderSpec("Trey Johnson", "Maverick Mobile Cuts", "trey@mavs.uta.edu",
                    "I bring the chair to your dorm",
                    "Mobile barber serving UTA dorms and apartments. I bring my own chair, clippers, cape and a shop vac so your room is cleaner when I leave than when I arrived. Group bookings on the same floor get a discount — round up your suitemates.",
                    "ut-arlington", "Mobile — UT Arlington dorms and apartments", null,
                    modes(LocationMode.AT_CUSTOMER), false, 4.5, 19, 20, true, EVENINGS,
                    new ServiceSpec[]{
                            new ServiceSpec("Dorm Room Cut", "Full cut in your space. I bring everything including cleanup.", "barbering", 30, 45),
                            new ServiceSpec("Cut + Beard Trim", "Cut plus beard shape without leaving your building.", "barbering", 40, 55)}));

            list.add(new ProviderSpec("Isabella Cruz", "Mean Green Nails", "isabella@unt.edu",
                    "Affordable sets for students who still want them cute",
                    "Nail tech in Denton keeping prices student-friendly without cutting corners on product. Acrylics, gel, and simple art. First-time clients get 10% off — the code is on my profile.",
                    "north-texas", "Fry Street area, Denton", null,
                    modes(LocationMode.AT_PROVIDER), false, 4.4, 24, 15, true,
                    new int[][]{{1, 13, 20}, {3, 13, 20}, {5, 11, 20}, {6, 10, 18}},
                    new ServiceSpec[]{
                            new ServiceSpec("Acrylic Full Set", "Shape of your choice with one solid colour or simple French.", "nails", 45, 90),
                            new ServiceSpec("Acrylic Fill", "Fill and reshape on an existing set within four weeks.", "nails", 35, 75),
                            new ServiceSpec("Polish Change", "Quick colour swap on an existing set.", "nails", 20, 30)}));

            list.add(new ProviderSpec("Ethan Park", "Denton Sound DJ", "ethan@unt.edu",
                    "House parties, formals and org events",
                    "Music major and working DJ. I read a room and I own my own gear — speakers, lights and a backup laptop, because the backup laptop is the difference between a party and a story. Send me your must-play list and your do-not-play list, I take both seriously.",
                    "north-texas", "Travels across Denton and DFW", null,
                    modes(LocationMode.AT_CUSTOMER), true, 4.9, 31, 60, false,
                    new int[][]{{5, 18, 23}, {6, 14, 23}, {7, 14, 20}},
                    new ServiceSpec[]{
                            new ServiceSpec("House Party Set (3 hr)", "Three hours, full sound system and basic lighting included.", "dj-events", 250, 180),
                            new ServiceSpec("Formal / Gala (4 hr)", "Four hours with MC duties, uplighting and a planning call.", "dj-events", 400, 240)}));

            list.add(new ProviderSpec("Grace Adeyemi", "Aggie Alterations", "grace@tamu.edu",
                    "Hems, fits and formal alterations",
                    "I have been sewing since I was eleven. Hemming, taking in, letting out, and making that thrifted piece actually fit. Formal season books out fast — bring your dress at least two weeks before the event, not two days.",
                    "texas-am", "Northgate area, College Station", null,
                    modes(LocationMode.AT_PROVIDER), true, 5.0, 44, 15, true, NINE_TO_SIX,
                    new ServiceSpec[]{
                            new ServiceSpec("Hem (trousers or dress)", "Clean hem finished to your shoe height. Bring the shoes.", "tailoring", 20, 30),
                            new ServiceSpec("Dress Alteration", "Take in, adjust straps, fix the fit for formals.", "tailoring", 55, 60),
                            new ServiceSpec("Suit Fit Package", "Jacket, sleeves and trousers adjusted together.", "tailoring", 90, 75)}));

            list.add(new ProviderSpec("Owen Fisher", "Reveille Study Lab", "owen@tamu.edu",
                    "Chemistry, physics and engineering fundamentals",
                    "Chemical engineering senior. I tutor the courses that wash people out: General Chem, Organic, Physics I and II, and Statics. I work through the problem sets with you rather than at you, and I will tell you honestly if you need more than one session.",
                    "texas-am", "Evans Library / online", null,
                    modes(LocationMode.AT_PROVIDER, LocationMode.ONLINE), false, 4.7, 26, 0, true,
                    new int[][]{{1, 14, 21}, {2, 14, 21}, {3, 14, 21}, {4, 14, 21}, {7, 13, 19}},
                    new ServiceSpec[]{
                            new ServiceSpec("General Chemistry — 1 hour", "Stoichiometry through equilibrium, with worked problems.", "tutoring", 28, 60),
                            new ServiceSpec("Organic Chemistry — 1 hour", "Mechanisms, synthesis and the reactions you keep missing.", "tutoring", 35, 60),
                            new ServiceSpec("Physics I & II — 1 hour", "Mechanics and E&M, calculus-based.", "tutoring", 30, 60)}));

            list.add(new ProviderSpec("Mia Delgado", "Red Raider Reels", "mia@ttu.edu",
                    "Content days, reels and event films",
                    "Videographer focused on short-form. Bring three outfits and we will leave with a month of content. I also film org recaps and game-day pieces. Turnaround is five days, rush is available.",
                    "texas-tech", "Lubbock — campus and around town", null,
                    modes(LocationMode.AT_CUSTOMER), false, 4.6, 14, 45, false,
                    new int[][]{{4, 15, 20}, {5, 10, 20}, {6, 10, 18}},
                    new ServiceSpec[]{
                            new ServiceSpec("Content Day (2 hr)", "Two hours of filming, 8-10 edited vertical clips.", "videography", 180, 120),
                            new ServiceSpec("Event Recap Film", "Coverage plus a 60-90 second edited recap.", "videography", 250, 180)}));

            list.add(new ProviderSpec("Zoe Carter", "Fresh Start Dorm Cleaning", "zoe@ttu.edu",
                    "Move-out cleans that get your deposit back",
                    "Deep cleans for dorms and student apartments. Move-out cleans are my speciality — I know exactly what the inspection checklist looks for. Supplies included. Book early in May, that week fills up completely.",
                    "texas-tech", "Lubbock student housing", null,
                    modes(LocationMode.AT_CUSTOMER), false, 4.8, 11, 30, true,
                    new int[][]{{1, 9, 16}, {2, 9, 16}, {4, 9, 16}, {6, 9, 15}},
                    new ServiceSpec[]{
                            new ServiceSpec("Dorm Deep Clean", "Full clean of a standard dorm room including bathroom.", "cleaning", 65, 120),
                            new ServiceSpec("Apartment Move-Out", "Kitchen, baths, floors and appliances to inspection standard.", "cleaning", 140, 240)}));

            return list;
        }
    }
}
