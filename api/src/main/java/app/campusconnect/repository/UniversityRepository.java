package app.campusconnect.repository;

import app.campusconnect.domain.University;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UniversityRepository extends JpaRepository<University, UUID> {

    Optional<University> findBySlug(String slug);

    List<University> findByActiveTrueOrderByNameAsc();

    boolean existsBySlug(String slug);

    /**
     * Resolves a campus from an email domain. This is what makes the
     * verified-student badge work without hardcoding any university's
     * conventions into the codebase.
     */
    @Query("select u from University u join u.emailDomains d where lower(d) = lower(:domain)")
    Optional<University> findByEmailDomain(@Param("domain") String domain);
}
