package app.campusconnect.repository;

import app.campusconnect.domain.TimeOff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TimeOffRepository extends JpaRepository<TimeOff, UUID> {

    @Query("""
            select t from TimeOff t
            where t.provider.id = :providerId and t.startAt < :to and t.endAt > :from
            """)
    List<TimeOff> findOverlapping(@Param("providerId") UUID providerId,
                                  @Param("from") LocalDateTime from,
                                  @Param("to") LocalDateTime to);

    @Query("""
            select t from TimeOff t
            where t.provider.id in :providerIds and t.startAt < :to and t.endAt > :from
            """)
    List<TimeOff> findOverlappingForProviders(@Param("providerIds") Collection<UUID> providerIds,
                                              @Param("from") LocalDateTime from,
                                              @Param("to") LocalDateTime to);

    List<TimeOff> findByProviderIdOrderByStartAtAsc(UUID providerId);
}
