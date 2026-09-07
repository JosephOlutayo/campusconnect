package app.campusconnect.repository;

import app.campusconnect.domain.ProviderProfile;
import app.campusconnect.domain.ProviderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProviderProfileRepository extends JpaRepository<ProviderProfile, UUID> {

    Optional<ProviderProfile> findByUserId(UUID userId);

    /**
     * Takes a row-level write lock (SELECT ... FOR UPDATE) on the provider.
     *
     * This is the concurrency primitive behind double-booking prevention: two
     * students racing for the same 5:30 slot are serialised here, so the second
     * one's overlap check runs only after the first has committed its booking.
     * Locking the provider (not the slot) is deliberate — there is no slot row
     * to lock, since slots are computed rather than stored.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProviderProfile p where p.id = :id")
    Optional<ProviderProfile> findByIdForUpdate(@Param("id") UUID id);

    List<ProviderProfile> findByStatus(ProviderStatus status);

    List<ProviderProfile> findByUniversityIdAndStatus(UUID universityId, ProviderStatus status);

    long countByStatus(ProviderStatus status);

    long countByUniversityIdAndStatus(UUID universityId, ProviderStatus status);

    /** Any status, including pending and rejected — all of them reference the campus. */
    long countByUniversityId(UUID universityId);

    @Query("""
            select p from ProviderProfile p
            where p.status = :status
              and (:universityId is null or p.university.id = :universityId)
              and (lower(p.businessName) like lower(concat('%', :term, '%'))
                   or lower(coalesce(p.tagline, '')) like lower(concat('%', :term, '%')))
            """)
    List<ProviderProfile> searchByName(@Param("term") String term,
                                       @Param("universityId") UUID universityId,
                                       @Param("status") ProviderStatus status);

    @Query("select avg(p.ratingAvg) from ProviderProfile p where p.ratingCount > 0 " +
           "and (:universityId is null or p.university.id = :universityId) and p.status = :status")
    Double averageRating(@Param("universityId") UUID universityId, @Param("status") ProviderStatus status);
}
