package app.campusconnect.view;

import app.campusconnect.domain.BookingStatus;
import app.campusconnect.domain.LocationMode;
import app.campusconnect.domain.ProviderProfile;
import app.campusconnect.repository.BookingRepository;
import app.campusconnect.repository.AvailabilityRuleRepository;
import app.campusconnect.repository.CategoryRepository;
import app.campusconnect.repository.ServiceOfferingRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.BookingService;
import app.campusconnect.service.ProviderService;
import app.campusconnect.web.ApiException;
import app.campusconnect.web.dto.ProviderDtos.AvailabilityRequest;
import app.campusconnect.web.dto.ProviderDtos.AvailabilityWindow;
import app.campusconnect.web.dto.ProviderDtos.OnboardingRequest;
import app.campusconnect.web.dto.ProviderDtos.ServiceRequest;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The provider's own area: setting the business up, seeing what is booked, and
 * managing what they offer.
 *
 * Every page here works from the signed-in user rather than an id in the URL —
 * ProviderService.requireOwned is the authorisation check, so one provider can
 * never reach another's dashboard by editing the address bar.
 */
@Controller
@RequestMapping("/provider")
public class ProviderViewController {

    private final ProviderService providerService;
    private final BookingService bookingService;
    private final BookingRepository bookings;
    private final ServiceOfferingRepository services;
    private final CategoryRepository categories;
    private final AvailabilityRuleRepository rules;

    public ProviderViewController(ProviderService providerService,
                                  BookingService bookingService,
                                  BookingRepository bookings,
                                  ServiceOfferingRepository services,
                                  CategoryRepository categories,
                                  AvailabilityRuleRepository rules) {
        this.providerService = providerService;
        this.bookingService = bookingService;
        this.bookings = bookings;
        this.services = services;
        this.categories = categories;
        this.rules = rules;
    }

    // --- setting up ----------------------------------------------------------

    @GetMapping("/onboarding")
    @Transactional(readOnly = true)
    public String onboardingForm(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        // Somebody who already has a business does not need this page again.
        try {
            providerService.requireOwned(me.id());
            return "redirect:/provider";
        } catch (ApiException notYet) {
            model.addAttribute("active", "provider");
            model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
            return "provider/onboarding";
        }
    }

    @PostMapping("/onboarding")
    public String onboard(@CurrentUser AuthenticatedUser me,
                          @RequestParam String businessName,
                          @RequestParam(required = false) String tagline,
                          @RequestParam String bio,
                          @RequestParam String locationLabel,
                          @RequestParam(required = false) String exactAddress,
                          @RequestParam List<LocationMode> locationModes,
                          @RequestParam UUID categoryId,
                          @RequestParam String serviceTitle,
                          @RequestParam String serviceDescription,
                          @RequestParam String price,
                          @RequestParam int durationMinutes,
                          Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        try {
            providerService.onboard(me.id(), new OnboardingRequest(
                    businessName, tagline, bio, locationLabel, exactAddress,
                    locationModes, categoryId, serviceTitle, serviceDescription,
                    toCents(price), durationMinutes));
            return "redirect:/provider";
        } catch (ApiException | IllegalArgumentException failed) {
            model.addAttribute("active", "provider");
            model.addAttribute("error", failed.getMessage());
            model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
            // Hand back what they typed, so a rejection does not empty the form.
            model.addAttribute("form", new OnboardingRequest(businessName, tagline, bio,
                    locationLabel, exactAddress, locationModes, categoryId,
                    serviceTitle, serviceDescription, 0, durationMinutes));
            model.addAttribute("price", price);
            return "provider/onboarding";
        }
    }

    // --- dashboard -----------------------------------------------------------

    @GetMapping
    @Transactional(readOnly = true)
    public String dashboard(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        ProviderProfile provider = ownedOrNull(me);
        if (provider == null) {
            return "redirect:/provider/onboarding";
        }

        model.addAttribute("active", "provider");
        model.addAttribute("provider", provider);
        model.addAttribute("stats", providerService.stats(me.id()));
        model.addAttribute("pending", loaded(bookings.findByProviderIdAndStatusOrderByStartAtAsc(
                provider.getId(), BookingStatus.PENDING)));
        model.addAttribute("upcoming", loaded(bookings.findByProviderIdAndStatusOrderByStartAtAsc(
                provider.getId(), BookingStatus.CONFIRMED)));
        return "provider/dashboard";
    }

    // --- bookings ------------------------------------------------------------

    @GetMapping("/bookings")
    @Transactional(readOnly = true)
    public String bookingList(@CurrentUser AuthenticatedUser me,
                              @RequestParam(required = false) String error,
                              Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        ProviderProfile provider = ownedOrNull(me);
        if (provider == null) {
            return "redirect:/provider/onboarding";
        }
        model.addAttribute("active", "provider");
        model.addAttribute("error", error);
        model.addAttribute("bookings",
                loaded(bookings.findByProviderIdOrderByStartAtDesc(provider.getId())));
        return "provider/bookings";
    }

    /**
     * Confirm, decline, complete or mark a no-show.
     *
     * Not @Transactional — BookingService manages its own, and a second one here
     * would mark itself rollback-only when the service refuses, turning a
     * refusal into a 500.
     */
    @PostMapping("/bookings/{id}/{action}")
    public String act(@PathVariable UUID id,
                      @PathVariable String action,
                      @RequestParam(required = false) String reason,
                      @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login";
        }
        try {
            switch (action) {
                case "confirm" -> bookingService.confirm(id, me.id());
                case "decline" -> bookingService.decline(id, me.id(), reason);
                case "complete" -> bookingService.complete(id, me.id());
                case "no-show" -> bookingService.markNoShow(id, me.id());
                default -> throw ApiException.badRequest("Unknown action.");
            }
            return "redirect:/provider/bookings";
        } catch (ApiException refused) {
            // Query parameter, not a flash attribute: the app is STATELESS.
            return "redirect:/provider/bookings?error="
                    + URLEncoder.encode(refused.getMessage(), StandardCharsets.UTF_8);
        }
    }

    // --- services ------------------------------------------------------------

    @GetMapping("/services")
    @Transactional(readOnly = true)
    public String serviceList(@CurrentUser AuthenticatedUser me,
                              @RequestParam(required = false) String error,
                              Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        ProviderProfile provider = ownedOrNull(me);
        if (provider == null) {
            return "redirect:/provider/onboarding";
        }
        model.addAttribute("active", "provider");
        model.addAttribute("error", error);
        model.addAttribute("services",
                services.findByProviderIdOrderByPriceCentsAsc(provider.getId()));
        model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
        return "provider/services";
    }

    @PostMapping("/services")
    public String addService(@CurrentUser AuthenticatedUser me,
                             @RequestParam String title,
                             @RequestParam String description,
                             @RequestParam UUID categoryId,
                             @RequestParam String price,
                             @RequestParam int durationMinutes,
                             @RequestParam(required = false) List<LocationMode> locationModes) {
        if (me == null) {
            return "redirect:/login";
        }
        try {
            providerService.addService(me.id(), new ServiceRequest(
                    title, description, categoryId, toCents(price), durationMinutes,
                    locationModes == null ? List.of() : locationModes, true));
            return "redirect:/provider/services";
        } catch (ApiException | IllegalArgumentException failed) {
            return "redirect:/provider/services?error="
                    + URLEncoder.encode(failed.getMessage(), StandardCharsets.UTF_8);
        }
    }

    @PostMapping("/services/{id}/remove")
    public String removeService(@PathVariable UUID id, @CurrentUser AuthenticatedUser me) {
        if (me == null) {
            return "redirect:/login";
        }
        try {
            providerService.removeService(me.id(), id);
            return "redirect:/provider/services";
        } catch (ApiException refused) {
            return "redirect:/provider/services?error="
                    + URLEncoder.encode(refused.getMessage(), StandardCharsets.UTF_8);
        }
    }

    // --- opening hours -------------------------------------------------------

    /**
     * The weekly schedule.
     *
     * Without hours a provider has no bookable slots at all, so this is the page
     * that decides whether a listing can be booked — not an optional extra.
     */
    @GetMapping("/availability")
    @Transactional(readOnly = true)
    public String availabilityForm(@CurrentUser AuthenticatedUser me,
                                   @RequestParam(required = false) String error,
                                   @RequestParam(required = false) String saved,
                                   Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        ProviderProfile provider = ownedOrNull(me);
        if (provider == null) {
            return "redirect:/provider/onboarding";
        }

        // Always all seven days, so the form is a fixed shape rather than a list
        // that grows and shrinks as days are turned on.
        var existing = rules.findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(provider.getId());
        List<DayRow> week = new ArrayList<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            var forDay = existing.stream().filter(rule -> rule.getDayOfWeek() == day).findFirst();
            week.add(new DayRow(
                    day.name(),
                    day.getDisplayName(TextStyle.FULL, Locale.ENGLISH),
                    forDay.isPresent(),
                    hhmm(forDay.map(rule -> rule.getStartMinute()).orElse(9 * 60)),
                    hhmm(forDay.map(rule -> rule.getEndMinute()).orElse(17 * 60))));
        }

        model.addAttribute("active", "provider");
        model.addAttribute("week", week);
        model.addAttribute("error", error);
        model.addAttribute("saved", saved != null);
        return "provider/availability";
    }

    /**
     * The whole week is posted at once and replaces what was there. A day whose
     * checkbox is off contributes no window, which is how a day off is
     * expressed — there is no separate "closed" record to keep in sync.
     */
    @PostMapping("/availability")
    public String saveAvailability(@CurrentUser AuthenticatedUser me,
                                   @RequestParam(required = false) List<String> open,
                                   @RequestParam Map<String, String> form) {
        if (me == null) {
            return "redirect:/login";
        }
        List<AvailabilityWindow> windows = new ArrayList<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            if (open == null || !open.contains(day.name())) {
                continue;
            }
            Integer start = minutes(form.get("start_" + day.name()));
            Integer end = minutes(form.get("end_" + day.name()));
            if (start == null || end == null) {
                return availabilityError("Enter both a start and an end time for every open day.");
            }
            if (end <= start) {
                return availabilityError("On " + day.getDisplayName(TextStyle.FULL, Locale.ENGLISH)
                        + ", the closing time has to be after the opening time.");
            }
            windows.add(new AvailabilityWindow(day.name(), start, end));
        }

        try {
            providerService.replaceAvailability(me.id(), new AvailabilityRequest(windows));
            return "redirect:/provider/availability?saved=1";
        } catch (ApiException refused) {
            return availabilityError(refused.getMessage());
        }
    }

    // --- earnings ------------------------------------------------------------

    @GetMapping("/earnings")
    @Transactional(readOnly = true)
    public String earnings(@CurrentUser AuthenticatedUser me, Model model) {
        if (me == null) {
            return "redirect:/login";
        }
        ProviderProfile provider = ownedOrNull(me);
        if (provider == null) {
            return "redirect:/provider/onboarding";
        }
        model.addAttribute("active", "provider");
        model.addAttribute("stats", providerService.stats(me.id()));
        // Only completed bookings have earned anything.
        model.addAttribute("completed", loaded(bookings.findByProviderIdAndStatusOrderByStartAtAsc(
                provider.getId(), BookingStatus.COMPLETED)));
        return "provider/earnings";
    }

    // --- helpers -------------------------------------------------------------

    private String availabilityError(String message) {
        return "redirect:/provider/availability?error="
                + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }

    /** Minutes from midnight to the HH:mm a time input expects. */
    private String hhmm(int minuteOfDay) {
        return String.format("%02d:%02d", minuteOfDay / 60, minuteOfDay % 60);
    }

    /** HH:mm back to minutes from midnight; null when the field was left empty. */
    private Integer minutes(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            LocalTime time = LocalTime.parse(value.trim());
            return time.getHour() * 60 + time.getMinute();
        } catch (RuntimeException notATime) {
            return null;
        }
    }

    /** One weekday in the opening-hours editor. */
    public record DayRow(String day, String label, boolean open, String start, String end) {
    }

    private ProviderProfile ownedOrNull(AuthenticatedUser me) {
        try {
            return providerService.requireOwned(me.id());
        } catch (ApiException noBusinessYet) {
            return null;
        }
    }

    /**
     * Money is entered as dollars and stored as integer cents, so rounding never
     * accumulates. Parsed here rather than in the template, where a bad value
     * would surface as a type-conversion failure instead of a message.
     */
    private int toCents(String dollars) {
        try {
            return (int) Math.round(Double.parseDouble(dollars.trim().replace("$", "")) * 100);
        } catch (RuntimeException notANumber) {
            throw ApiException.badRequest("Enter the price as a number, for example 25 or 25.50.");
        }
    }

    /**
     * Touches what the templates read, before the transaction closes.
     * open-in-view is off, so a lazy read during rendering fails the page.
     */
    private <T extends app.campusconnect.domain.Booking> List<T> loaded(List<T> list) {
        list.forEach(b -> {
            b.getCustomer().getName();
            b.getService().getTitle();
        });
        return list;
    }
}
