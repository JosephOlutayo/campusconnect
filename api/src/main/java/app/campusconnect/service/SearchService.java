package app.campusconnect.service;

import app.campusconnect.domain.*;
import app.campusconnect.repository.*;
import app.campusconnect.web.dto.CatalogDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Discovery and search.
 *
 * Two-stage by design: indexed filtering happens in SQL, then relevance ranking
 * and grouping happen in memory over a bounded result set. That keeps the query
 * portable and readable, and is honest about scale — at campus size this is
 * comfortably fast, and the replacement (a Postgres tsvector or trigram index)
 * slots in behind the same method signature.
 */
@Service
public class SearchService {

    /** Ranking never sees more than this many rows. */
    private static final int MAX_ROWS = 400;
    private static final int NEXT_AVAILABLE_LOOKAHEAD_DAYS = 14;

    private final ServiceOfferingRepository services;
    private final CategoryRepository categories;
    private final ProviderProfileRepository providers;
    private final PortfolioImageRepository portfolio;
    private final FavoriteRepository favorites;
    private final AvailabilityService availabilityService;

    public SearchService(ServiceOfferingRepository services,
                         CategoryRepository categories,
                         ProviderProfileRepository providers,
                         PortfolioImageRepository portfolio,
                         FavoriteRepository favorites,
                         AvailabilityService availabilityService) {
        this.services = services;
        this.categories = categories;
        this.providers = providers;
        this.portfolio = portfolio;
        this.favorites = favorites;
        this.availabilityService = availabilityService;
    }

    public record SearchQuery(String q, String categorySlug, UUID universityId,
                              Integer minPriceCents, Integer maxPriceCents, Double minRating,
                              Set<LocationMode> locationModes, String availability,
                              String sort, boolean verifiedOnly, int page, int perPage) {
    }

    /**
     * Turns a raw phrase into the categories it implies.
     * "math tutor" hits Tutoring because that category carries "tutor" as a
     * keyword — synonyms are data, not a hardcoded map in this class.
     */
    @Transactional(readOnly = true)
    public List<UUID> categoriesImpliedBy(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> tokens = Arrays.stream(raw.toLowerCase().trim().split("\\s+"))
                .filter(token -> token.length() > 1)
                .toList();
        if (tokens.isEmpty()) {
            return List.of();
        }

        List<UUID> matches = new ArrayList<>();
        for (Category category : categories.findByActiveTrueOrderBySortOrderAsc()) {
            List<String> haystack = new ArrayList<>();
            haystack.add(category.getName().toLowerCase());
            haystack.add(category.getSlug().toLowerCase());
            category.getKeywords().forEach(keyword -> haystack.add(keyword.toLowerCase()));

            boolean hit = tokens.stream().anyMatch(token ->
                    haystack.stream().anyMatch(entry -> entry.contains(token) || token.contains(entry)));
            if (hit) {
                matches.add(category.getId());
            }
        }
        return matches;
    }

    /**
     * Cards for a specific set of providers, in the order given.
     * Used by the saved-providers page, which already knows who it wants and so
     * skips filtering and ranking entirely.
     */
    @Transactional(readOnly = true)
    public List<ProviderCardDto> cardsForProviders(List<UUID> providerIds) {
        if (providerIds.isEmpty()) {
            return List.of();
        }
        List<ServiceOffering> rows = new ArrayList<>();
        for (UUID providerId : providerIds) {
            rows.addAll(services.findByProviderIdAndActiveTrueOrderByPriceCentsAsc(providerId));
        }
        List<ProviderCardDto> cards = buildCards(rows, null);

        // Preserve the caller's ordering (favourites are newest-saved first).
        Map<UUID, ProviderCardDto> byId = new LinkedHashMap<>();
        cards.forEach(card -> byId.put(card.providerId(), card));
        return providerIds.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    @Transactional(readOnly = true)
    public SearchResultDto search(SearchQuery query, UUID viewerId) {
        String term = (query.q() == null || query.q().isBlank()) ? null : query.q().trim();
        List<UUID> impliedCategories = categoriesImpliedBy(term);
        // The IN clause needs a non-empty list on some dialects.
        List<UUID> categoryIds = impliedCategories.isEmpty()
                ? List.of(new UUID(0, 0))
                : impliedCategories;

        List<ServiceOffering> rows = services.search(
                term, categoryIds, query.categorySlug(), query.universityId(),
                query.minPriceCents(), query.maxPriceCents(), query.minRating(),
                query.verifiedOnly(), ProviderStatus.ACTIVE);

        if (rows.size() > MAX_ROWS) {
            rows = rows.subList(0, MAX_ROWS);
        }
        List<ProviderCardDto> cards = buildCards(rows, query.locationModes());

        if (cards.isEmpty()) {
            return new SearchResultDto(List.of(), 0, query.page(), query.perPage(), 1);
        }
        List<ProviderCardDto> filtered = applyAvailabilityFilter(cards, query.availability());
        sort(filtered, query.sort(), term);

        int total = filtered.size();
        int perPage = Math.max(1, query.perPage());
        int page = Math.max(1, query.page());
        int totalPages = Math.max(1, (int) Math.ceil(total / (double) perPage));
        int start = Math.min((page - 1) * perPage, total);
        int end = Math.min(start + perPage, total);

        return new SearchResultDto(filtered.subList(start, end), total, page, perPage, totalPages);
    }

    /**
     * Collapses a flat list of services into one card per provider and enriches
     * them with portfolio seeds and next-available. Shared by search and by the
     * saved-providers page so the card shape can never drift between them.
     *
     * @param modeFilter optional location-mode filter; null or empty keeps everything.
     */
    private List<ProviderCardDto> buildCards(List<ServiceOffering> rows, Set<LocationMode> modeFilter) {

        // Collapse to one card per provider. "from" is the cheapest match, but
        // the headline is the most-booked service — picking the cheapest would
        // make a barber look like a $12 line-up shop.
        Map<UUID, ServiceOffering> headlineByProvider = new LinkedHashMap<>();
        Map<UUID, Integer> fromPriceByProvider = new HashMap<>();
        Map<UUID, Integer> serviceCountByProvider = new HashMap<>();

        for (ServiceOffering service : rows) {
            ProviderProfile provider = service.getProvider();
            if (modeFilter != null && !modeFilter.isEmpty()) {
                boolean matches = service.effectiveLocationModes().stream()
                        .anyMatch(modeFilter::contains);
                if (!matches) {
                    continue;
                }
            }
            UUID providerId = provider.getId();
            serviceCountByProvider.merge(providerId, 1, Integer::sum);
            fromPriceByProvider.merge(providerId, service.getPriceCents(), Math::min);

            ServiceOffering current = headlineByProvider.get(providerId);
            boolean better = current == null
                    || service.getBookingCount() > current.getBookingCount()
                    || (service.getBookingCount() == current.getBookingCount()
                        && service.getPriceCents() > current.getPriceCents());
            if (better) {
                headlineByProvider.put(providerId, service);
            }
        }

        if (headlineByProvider.isEmpty()) {
            return List.of();
        }

        // Next-available for the whole page in one batch, not one query each.
        Map<UUID, Integer> durations = new HashMap<>();
        headlineByProvider.forEach((providerId, service) ->
                durations.put(providerId, service.getDurationMinutes()));
        Map<UUID, LocalDateTime> nextAvailable =
                availabilityService.nextAvailableBatch(durations, NEXT_AVAILABLE_LOOKAHEAD_DAYS);

        Map<UUID, List<String>> seedsByProvider = new HashMap<>();
        for (PortfolioImage image : portfolio.findByProviderIdInOrderBySortOrderAsc(headlineByProvider.keySet())) {
            seedsByProvider.computeIfAbsent(image.getProvider().getId(), k -> new ArrayList<>())
                    .add(image.getSeed());
        }

        List<ProviderCardDto> cards = new ArrayList<>();
        headlineByProvider.forEach((providerId, service) -> {
            ProviderProfile provider = service.getProvider();
            University university = provider.getUniversity();

            cards.add(new ProviderCardDto(
                    providerId,
                    provider.getBusinessName(),
                    provider.getTagline(),
                    provider.getUser().getAvatarSeed(),
                    provider.isVerified(),
                    provider.getRatingAvg(),
                    provider.getRatingCount(),
                    provider.getCompletedBookings(),
                    university.getShortName(),
                    university.getSlug(),
                    provider.getLocationLabel(),
                    List.copyOf(service.effectiveLocationModes()),
                    Geo.distanceMiles(university.getLatitude(), university.getLongitude(),
                            provider.getLatitude(), provider.getLongitude()),
                    new HeadlineServiceDto(service.getId(), service.getTitle(),
                            service.getPriceCents(), service.getDurationMinutes(),
                            service.getCategory().getName(), service.getCategory().getIcon()),
                    serviceCountByProvider.getOrDefault(providerId, 1),
                    fromPriceByProvider.getOrDefault(providerId, service.getPriceCents()),
                    seedsByProvider.getOrDefault(providerId, List.of()),
                    nextAvailable.get(providerId),
                    provider.getCreatedAt()));
        });


        return cards;
    }

    private List<ProviderCardDto> applyAvailabilityFilter(List<ProviderCardDto> cards, String availability) {
        if (availability == null || availability.isBlank() || "any".equals(availability)) {
            return cards;
        }
        LocalDate today = LocalDate.now();
        return cards.stream().filter(card -> {
            if (card.nextAvailable() == null) {
                return false;
            }
            return switch (availability) {
                case "today" -> card.nextAvailable().toLocalDate().equals(today);
                case "week" -> !card.nextAvailable().toLocalDate().isAfter(today.plusDays(7));
                default -> true;
            };
        }).toList();
    }

    /** Bayesian-ish: one five-star review should not outrank forty 4.8s. */
    private double recommendedScore(ProviderCardDto card) {
        double confidence = Math.log10(card.ratingCount() + 1.0);
        return card.ratingAvg() * (1 + confidence) + Math.log10(card.completedBookings() + 1.0);
    }

    private int relevanceScore(ProviderCardDto card, List<String> tokens) {
        int score = 0;
        String business = card.businessName().toLowerCase();
        String title = card.headlineService().title().toLowerCase();
        String category = card.headlineService().categoryName().toLowerCase();
        for (String token : tokens) {
            if (business.contains(token)) score += 6;
            if (title.contains(token)) score += 4;
            if (category.contains(token)) score += 3;
        }
        return score;
    }

    private void sort(List<ProviderCardDto> cards, String sort, String term) {
        String mode = (sort == null || sort.isBlank()) ? "recommended" : sort;
        List<String> tokens = term == null
                ? List.of()
                : Arrays.stream(term.toLowerCase().split("\\s+")).filter(t -> t.length() > 1).toList();

        Comparator<ProviderCardDto> comparator = switch (mode) {
            case "rating" -> Comparator.comparingDouble(ProviderCardDto::ratingAvg).reversed()
                    .thenComparing(Comparator.comparingInt(ProviderCardDto::ratingCount).reversed());
            case "price_asc" -> Comparator.comparingInt(ProviderCardDto::fromPriceCents);
            case "price_desc" -> Comparator.comparingInt(ProviderCardDto::fromPriceCents).reversed();
            case "distance" -> Comparator.comparingDouble(card ->
                    card.distanceMiles() == null ? Double.MAX_VALUE : card.distanceMiles());
            case "booked" -> Comparator.comparingInt(ProviderCardDto::completedBookings).reversed();
            case "newest" -> Comparator.comparing(ProviderCardDto::createdAt).reversed();
            default -> {
                if (!tokens.isEmpty()) {
                    yield Comparator.<ProviderCardDto>comparingInt(card -> relevanceScore(card, tokens))
                            .reversed()
                            .thenComparing(Comparator.comparingDouble(this::recommendedScore).reversed());
                }
                yield Comparator.comparingDouble(this::recommendedScore).reversed();
            }
        };
        cards.sort(comparator);
    }

    /** Lightweight typeahead: categories, then providers, then services. */
    @Transactional(readOnly = true)
    public SuggestionDto suggest(String q, UUID universityId) {
        String term = q == null ? "" : q.trim();
        if (term.length() < 2) {
            return new SuggestionDto(List.of(), List.of(), List.of());
        }

        List<UUID> implied = categoriesImpliedBy(term);
        List<SuggestionDto.CategorySuggestion> categoryHits =
                (implied.isEmpty() ? List.<Category>of() : categories.findByIdInOrderBySortOrderAsc(implied))
                        .stream()
                        .limit(4)
                        .map(c -> new SuggestionDto.CategorySuggestion(c.getName(), c.getSlug(), c.getIcon()))
                        .toList();

        List<SuggestionDto.ProviderSuggestion> providerHits =
                providers.searchByName(term, universityId, ProviderStatus.ACTIVE).stream()
                        .limit(4)
                        .map(p -> new SuggestionDto.ProviderSuggestion(
                                p.getId(), p.getBusinessName(), p.getRatingAvg(),
                                p.getUser().getAvatarSeed()))
                        .toList();

        List<SuggestionDto.ServiceSuggestion> serviceHits =
                services.suggest(term, universityId, ProviderStatus.ACTIVE).stream()
                        .limit(4)
                        .map(s -> new SuggestionDto.ServiceSuggestion(
                                s.getId(), s.getTitle(), s.getPriceCents(),
                                s.getProvider().getId(), s.getProvider().getBusinessName()))
                        .toList();

        return new SuggestionDto(categoryHits, providerHits, serviceHits);
    }
}
