package app.campusconnect.repository;

import app.campusconnect.domain.AvailabilityRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AvailabilityRuleRepository extends JpaRepository<AvailabilityRule, UUID> {

    List<AvailabilityRule> findByProviderIdOrderByDayOfWeekAscStartMinuteAsc(UUID providerId);

    /** Batch load for the search page, so N providers cost one query. */
    List<AvailabilityRule> findByProviderIdIn(Collection<UUID> providerIds);

    void deleteByProviderId(UUID providerId);
}
