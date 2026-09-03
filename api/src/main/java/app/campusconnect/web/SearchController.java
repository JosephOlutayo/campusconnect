package app.campusconnect.web;

import app.campusconnect.domain.LocationMode;
import app.campusconnect.repository.UserRepository;
import app.campusconnect.security.AuthenticatedUser;
import app.campusconnect.security.CurrentUser;
import app.campusconnect.service.SearchService;
import app.campusconnect.web.dto.CatalogDtos.SearchResultDto;
import app.campusconnect.web.dto.CatalogDtos.SuggestionDto;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;
    private final UserRepository users;

    public SearchController(SearchService searchService, UserRepository users) {
        this.searchService = searchService;
        this.users = users;
    }

    /** Signed-in students default to their own campus; guests see everything. */
    private UUID defaultUniversity(AuthenticatedUser me, String explicit) {
        if (explicit != null && !explicit.isBlank()) {
            return "all".equalsIgnoreCase(explicit) ? null : UUID.fromString(explicit);
        }
        if (me == null) {
            return null;
        }
        return users.findById(me.id())
                .map(user -> user.getUniversity() == null ? null : user.getUniversity().getId())
                .orElse(null);
    }

    @GetMapping
    public ApiResponse<SearchResultDto> search(
            @CurrentUser AuthenticatedUser me,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String university,
            @RequestParam(required = false) Integer minPrice,
            @RequestParam(required = false) Integer maxPrice,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) String where,
            @RequestParam(required = false, defaultValue = "any") String availability,
            @RequestParam(required = false, defaultValue = "recommended") String sort,
            @RequestParam(required = false, defaultValue = "false") boolean verified,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "12") int perPage) {

        Set<LocationMode> modes = (where == null || where.isBlank())
                ? Set.of()
                : Arrays.stream(where.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .map(value -> {
                        try {
                            return LocationMode.valueOf(value);
                        } catch (IllegalArgumentException ex) {
                            throw ApiException.badRequest("Unknown location filter: " + value);
                        }
                    })
                    .collect(Collectors.toSet());

        var query = new SearchService.SearchQuery(
                q, category, defaultUniversity(me, university),
                minPrice, maxPrice, minRating, modes, availability, sort, verified,
                page, Math.min(48, Math.max(1, perPage)));

        return ApiResponse.ok(searchService.search(query, me == null ? null : me.id()));
    }

    @GetMapping("/suggest")
    public ApiResponse<SuggestionDto> suggest(@CurrentUser AuthenticatedUser me,
                                              @RequestParam(required = false) String q,
                                              @RequestParam(required = false) String university) {
        return ApiResponse.ok(searchService.suggest(q, defaultUniversity(me, university)));
    }
}
