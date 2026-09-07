package app.campusconnect.view;

import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Terms, privacy and community guidelines.
 *
 * These are honest drafts describing how the product actually behaves. They are
 * NOT legal advice and have not been reviewed by a lawyer — which the page says
 * out loud, because a policy page that looks finished when it is not is worse
 * than no policy page at all.
 */
@Controller
public class LegalViewController {

    private static final String DRAFT_NOTE = "Draft — not yet reviewed by counsel";

    private static final Map<String, Doc> DOCS = new LinkedHashMap<>();

    static {
        DOCS.put("terms", new Doc("terms", "Terms of service", DRAFT_NOTE, List.of(
                new Section("What CampusConnect is",
                        "CampusConnect is a marketplace. We connect students who need a service "
                                + "with students and local providers who offer one. We are not the "
                                + "provider. We do not employ providers, supervise their work, or "
                                + "guarantee any particular result."),
                new Section("Accounts",
                        "You must be 18 or older, or have your guardian's permission, to create an "
                                + "account. You are responsible for what happens under your account. "
                                + "One person, one account. Providing false information — including "
                                + "impersonating a student at a campus you do not attend — is grounds "
                                + "for removal."),
                new Section("Bookings and cancellations",
                        "A booking is an agreement between you and the provider. Each provider sets "
                                + "their own cancellation policy, shown before you confirm. "
                                + "Repeatedly cancelling late or failing to show up may result in "
                                + "restrictions on your account."),
                new Section("Payments and fees",
                        "The platform charges providers a marketplace fee on each completed booking. "
                                + "The exact percentage is shown to providers before they list and on "
                                + "every booking summary. Prices displayed to students always include "
                                + "what they will pay."),
                new Section("Prohibited services",
                        "No services that require a licence the provider does not hold, nothing "
                                + "illegal, nothing sexual, and no medical or cosmetic procedures "
                                + "beyond what local regulation allows for the provider's "
                                + "certification. We remove listings and accounts that break this."),
                new Section("Meeting in person",
                        "Services involve meeting real people, often in private spaces. You are "
                                + "responsible for your own safety. We give you tools — verification, "
                                + "reviews, in-app messaging, reporting and blocking — but we cannot "
                                + "supervise a meeting."),
                new Section("Termination",
                        "We may suspend or remove any account that breaks these terms, and you can "
                                + "stop using the platform at any time."))));

        DOCS.put("privacy", new Doc("privacy", "Privacy policy", DRAFT_NOTE, List.of(
                new Section("What we collect",
                        "Your name, email, university, and anything you add to your profile. For "
                                + "providers: business details, service listings, availability and "
                                + "payout information. We record bookings, messages sent through the "
                                + "app, and reviews."),
                new Section("What we show other people",
                        "Your name, avatar, campus and verification badges are visible to providers "
                                + "you book. Providers' approximate location is public; their exact "
                                + "address is only released to a customer after a booking is "
                                + "confirmed. Phone numbers are never displayed to other users."),
                new Section("Messages",
                        "Messages sent in the app are stored so both sides have a record and so we "
                                + "can investigate reports. Do not send anything you would not want a "
                                + "moderator to read during a dispute."),
                new Section("Payments",
                        "When real payments are enabled, card details are handled by Stripe and never "
                                + "touch our servers. We store only the amount, the fee split and "
                                + "Stripe's reference id."),
                new Section("Your choices",
                        "You can edit or delete your profile information at any time, block other "
                                + "users, and request deletion of your account. Deleting an account "
                                + "removes your profile; bookings and payment records are retained "
                                + "where we are required to keep them."),
                new Section("Contact",
                        "Questions about your data go to privacy@campusconnect.app."))));

        DOCS.put("guidelines", new Doc("guidelines", "Community guidelines", DRAFT_NOTE, List.of(
                new Section("Show up",
                        "If you book, be there. If you cannot make it, cancel as early as you can. A "
                                + "late cancellation costs a student provider real money — often an "
                                + "hour they turned someone else away for."),
                new Section("Be honest in listings",
                        "Portfolio photos must be your own work. Prices shown must be the prices you "
                                + "charge. If a service usually runs long, say so in the description "
                                + "rather than surprising someone mid-appointment."),
                new Section("Reviews are earned",
                        "You can only review a provider after completing an appointment with them. Do "
                                + "not trade reviews, ask for a specific rating, or offer a discount "
                                + "in exchange for five stars. We remove reviews that break this, and "
                                + "repeated attempts cost you your account."),
                new Section("Keep it in the app",
                        "Message through CampusConnect. If something goes wrong, that record is what "
                                + "lets us help. Moving to text or cash off-platform means we cannot "
                                + "see what was agreed."),
                new Section("Safety first",
                        "Meet somewhere you are comfortable. Tell a friend where you are going. If a "
                                + "provider or customer makes you feel unsafe, block them and report — "
                                + "you never owe anyone an explanation for leaving."),
                new Section("No harassment, no discrimination",
                        "Refusing service based on race, gender, religion, disability, sexuality or "
                                + "nationality is not allowed here. Neither is harassment of any kind. "
                                + "This is the one rule where the first strike can be the last."))));
    }

    @GetMapping("/legal")
    public String index(Model model) {
        model.addAttribute("active", "legal");
        model.addAttribute("docs", List.copyOf(DOCS.values()));
        return "legal/index";
    }

    @GetMapping("/legal/{doc}")
    public String document(@PathVariable String doc, Model model) {
        Doc entry = DOCS.get(doc);
        if (entry == null) {
            throw ApiException.notFound("That document does not exist.");
        }
        model.addAttribute("active", "legal");
        model.addAttribute("doc", entry);
        return "legal/document";
    }

    public record Section(String heading, String body) {
    }

    public record Doc(String slug, String title, String updated, List<Section> sections) {
    }
}
