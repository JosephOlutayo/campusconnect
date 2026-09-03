package app.campusconnect.repository;

import app.campusconnect.domain.PortfolioImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PortfolioImageRepository extends JpaRepository<PortfolioImage, UUID> {

    List<PortfolioImage> findByProviderIdOrderBySortOrderAsc(UUID providerId);

    List<PortfolioImage> findByProviderIdInOrderBySortOrderAsc(Collection<UUID> providerIds);
}
