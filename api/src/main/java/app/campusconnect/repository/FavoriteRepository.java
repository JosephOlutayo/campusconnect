package app.campusconnect.repository;

import app.campusconnect.domain.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface FavoriteRepository extends JpaRepository<Favorite, UUID> {

    List<Favorite> findByUserIdOrderByCreatedAtDesc(UUID userId);

    boolean existsByUserIdAndProviderId(UUID userId, UUID providerId);

    void deleteByUserIdAndProviderId(UUID userId, UUID providerId);

    long countByUserId(UUID userId);

    /** Just the ids, for marking hearts on a page of search results. */
    @Query("select f.provider.id from Favorite f where f.user.id = :userId")
    List<UUID> findProviderIdsForUser(@Param("userId") UUID userId);
}
