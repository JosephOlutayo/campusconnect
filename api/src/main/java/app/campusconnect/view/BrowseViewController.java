package app.campusconnect.view;

import app.campusconnect.domain.LocationMode;
import app.campusconnect.domain.ProviderStatus;
import app.campusconnect.domain.University;
import app.campusconnect.repository.CategoryRepository;
import app.campusconnect.repository.ProviderProfileRepository;
import app.campusconnect.repository.UniversityRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.SearchService;
import app.campusconnect.service.SearchService.SearchQuery;
import app.campusconnect.web.ApiException;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Set;
import java.util.UUID;

/**
 * The pages anyone can see without an account: home, explore, categories and
 * campuses.
 *
 * These render server-side rather than fetching from the REST API, because
 * going out over HTTP to the same process would add a network hop for nothing.
 * The REST controllers stay for the parts that genuinely need them.
 */
@Controller
@Transactional(readOnly = true)
public class BrowseViewController {

    /** One screen of results; the rest is behind pagination. */
    private static final int PER_PAGE = 12;

    private final SearchService searchService;
    private final CategoryRepository categories;
    private final UniversityRepository universities;
    private final ProviderProfileRepository providers;

    public BrowseViewController(SearchService searchService,
                                CategoryRepository categories,
                                UniversityRepository universities,
                                ProviderProfileRepository providers) {
        this.searchService = searchService;
        this.categories = categories;
        this.universities = universities;
        this.providers = providers;
    }

    @GetMapping("/")
    public String home(@CurrentUser AuthenticatedUser me, Model model) {
        model.addAttribute("active", "home");
        model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
        model.addAttribute("campuses", universities.findByActiveTrueOrderByNameAsc());
        model.addAttribute("providerCount", providers.countByStatus(ProviderStatus.ACTIVE));

        // A handful of providers to show the marketplace is not empty.
        SearchQuery query = new SearchQuery(null, null, null, null, null, null,
                Set.of(), null, "recommended", false, 1, 6);
        model.addAttribute("featured",
                searchService.search(query, me == null ? null : me.id()).cards());
        return "home";
    }

    @GetMapping("/explore")
    public String explore(@RequestParam(required = false) String q,
                          @RequestParam(required = false) String category,
                          @RequestParam(required = false) UUID campus,
                          @RequestParam(required = false, defaultValue = "recommended") String sort,
                          @RequestParam(required = false, defaultValue = "1") int page,
                          @CurrentUser AuthenticatedUser me,
                          Model model) {

        SearchQuery query = new SearchQuery(
                q, category, campus, null, null, null,
                Set.<LocationMode>of(), null, sort, false, Math.max(1, page), PER_PAGE);

        var results = searchService.search(query, me == null ? null : me.id());

        model.addAttribute("active", "explore");
        model.addAttribute("results", results);
        model.addAttribute("q", q);
        model.addAttribute("selectedCategory", category);
        model.addAttribute("selectedCampus", campus);
        model.addAttribute("sort", sort);
        model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
        model.addAttribute("campuses", universities.findByActiveTrueOrderByNameAsc());
        return "explore";
    }

    @GetMapping("/categories")
    public String categories(Model model) {
        model.addAttribute("active", "categories");
        model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
        return "categories";
    }

    @GetMapping("/campuses")
    public String campuses(Model model) {
        model.addAttribute("active", "campuses");
        model.addAttribute("campuses", universities.findByActiveTrueOrderByNameAsc());
        return "campuses";
    }

    /**
     * One campus and who works around it.
     *
     * Addressed by slug rather than id so the link is readable and survives the
     * database being rebuilt.
     */
    @GetMapping("/campuses/{slug}")
    public String campus(@PathVariable String slug,
                         @RequestParam(required = false, defaultValue = "1") int page,
                         @CurrentUser AuthenticatedUser me,
                         Model model) {
        var campus = universities.findBySlug(slug.toLowerCase())
                .filter(University::isActive)
                .orElseThrow(() -> ApiException.notFound("No campus at that address."));

        SearchQuery query = new SearchQuery(null, null, campus.getId(), null, null, null,
                Set.<LocationMode>of(), null, "recommended", false, Math.max(1, page), PER_PAGE);

        model.addAttribute("active", "campuses");
        model.addAttribute("campus", campus);
        model.addAttribute("results", searchService.search(query, me == null ? null : me.id()));
        model.addAttribute("categories", categories.findByActiveTrueOrderBySortOrderAsc());
        return "campus";
    }
}
