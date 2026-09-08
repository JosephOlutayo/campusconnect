package app.campusconnect.repository;

import app.campusconnect.domain.Role;
import app.campusconnect.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    long countByRoleAndSuspendedFalse(Role role);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByRole(Role role);

    long countByRole(Role role);

    /** Guards campus deletion: a campus with accounts on it must not vanish. */
    long countByUniversityId(UUID universityId);

    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:term = '' or lower(u.name) like lower(concat('%', :term, '%'))
                   or lower(u.email) like lower(concat('%', :term, '%')))
            order by u.createdAt desc
            """)
    List<User> search(@Param("term") String term, @Param("role") Role role);
}
