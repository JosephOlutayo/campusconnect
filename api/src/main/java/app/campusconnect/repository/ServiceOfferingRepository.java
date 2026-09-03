package app.campusconnect.repository;

import app.campusconnect.domain.ProviderStatus;
import app.campusconnect.domain.ServiceOffering;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, UUID> {

    List<ServiceOffering> findByProviderIdOrderByPriceCentsAsc(UUID providerId);

    List<ServiceOffering> findByProviderIdAndActiveTrueOrderByPriceCentsAsc(UUID providerId);

    long countByActiveTrue();

    /**
     * The search query.
     *
     * Filtering happens in SQL over indexed columns; relevance ranking happens
     * in memory afterwards (SearchService). That split keeps the query simple
     * and portable, and is honest about scale — swap this for a Postgres
     * tsvector index when the catalogue outgrows a campus.
     */
    @Query("""
            select s from ServiceOffering s
              join fetch s.provider p
              join fetch s.category c
              join fetch p.user u
              join fetch p.university uni
            where s.active = true
              and p.status = :status
              and u.suspended = false
              and (:universityId is null or p.university.id = :universityId)
              and (:categorySlug is null or c.slug = :categorySlug)
              and (:minPrice is null or s.priceCents >= :minPrice)
              and (:maxPrice is null or s.priceCents <= :maxPrice)
              and (:minRating is null or p.ratingAvg >= :minRating)
              and (:verifiedOnly = false or p.verified = true)
              and (:term is null
                   or lower(s.title) like lower(concat('%', :term, '%'))
                   or lower(s.description) like lower(concat('%', :term, '%'))
                   or lower(p.businessName) like lower(concat('%', :term, '%'))
                   or lower(coalesce(p.tagline, '')) like lower(concat('%', :term, '%'))
                   or lower(c.name) like lower(concat('%', :term, '%'))
                   or c.id in :categoryIds)
            """)
    List<ServiceOffering> search(@Param("term") String term,
                                 @Param("categoryIds") Collection<UUID> categoryIds,
                                 @Param("categorySlug") String categorySlug,
                                 @Param("universityId") UUID universityId,
                                 @Param("minPrice") Integer minPrice,
                                 @Param("maxPrice") Integer maxPrice,
                                 @Param("minRating") Double minRating,
                                 @Param("verifiedOnly") boolean verifiedOnly,
                                 @Param("status") ProviderStatus status);

    /** Typeahead: service titles only, deliberately cheap. */
    @Query("""
            select s from ServiceOffering s
            where s.active = true and s.provider.status = :status
              and lower(s.title) like lower(concat('%', :term, '%'))
              and (:universityId is null or s.provider.university.id = :universityId)
            """)
    List<ServiceOffering> suggest(@Param("term") String term,
                                  @Param("universityId") UUID universityId,
                                  @Param("status") ProviderStatus status);

    @Query("select distinct s.category.id from ServiceOffering s " +
           "where s.active = true and s.provider.university.id = :universityId and s.provider.status = :status")
    List<UUID> findCategoryIdsForUniversity(@Param("universityId") UUID universityId,
                                            @Param("status") ProviderStatus status);
}
