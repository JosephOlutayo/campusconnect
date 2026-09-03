package app.campusconnect.repository;

import app.campusconnect.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    Optional<Category> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Category> findByActiveTrueOrderBySortOrderAsc();

    List<Category> findByIdInOrderBySortOrderAsc(Collection<UUID> ids);
}
