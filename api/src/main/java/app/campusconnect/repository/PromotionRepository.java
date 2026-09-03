package app.campusconnect.repository;

import app.campusconnect.domain.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    Optional<Promotion> findByProviderIdAndCodeIgnoreCase(UUID providerId, String code);

    List<Promotion> findByProviderIdOrderByCreatedAtDesc(UUID providerId);

    List<Promotion> findByProviderIdAndActiveTrue(UUID providerId);
}
