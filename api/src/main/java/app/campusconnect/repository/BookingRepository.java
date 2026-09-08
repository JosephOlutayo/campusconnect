package app.campusconnect.repository;

import app.campusconnect.domain.Booking;
import app.campusconnect.domain.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    Optional<Booking> findByCode(String code);

    /**
     * THE double-booking query.
     *
     * Two intervals overlap when each starts before the other ends. Comparing
     * against blockEndAt (rather than endAt) means the provider's buffer counts
     * as occupied time, so back-to-back bookings still respect turnaround.
     *
     * Called inside the booking transaction, after a pessimistic lock on the
     * provider row — see BookingService#create.
     */
    @Query("""
            select count(b) > 0 from Booking b
            where b.provider.id = :providerId
              and b.status in :blocking
              and b.startAt < :blockEnd
              and b.blockEndAt > :start
              and (:excludeId is null or b.id <> :excludeId)
            """)
    boolean existsOverlap(@Param("providerId") UUID providerId,
                          @Param("start") LocalDateTime start,
                          @Param("blockEnd") LocalDateTime blockEnd,
                          @Param("blocking") Collection<BookingStatus> blocking,
                          @Param("excludeId") UUID excludeId);

    /** Everything occupying a provider's calendar in a window — feeds the slot engine. */
    @Query("""
            select b from Booking b
            where b.provider.id = :providerId
              and b.status in :blocking
              and b.startAt < :to
              and b.blockEndAt > :from
            """)
    List<Booking> findBlockingInWindow(@Param("providerId") UUID providerId,
                                       @Param("from") LocalDateTime from,
                                       @Param("to") LocalDateTime to,
                                       @Param("blocking") Collection<BookingStatus> blocking);

    /** Batch variant so a page of search results costs one query, not N. */
    @Query("""
            select b from Booking b
            where b.provider.id in :providerIds
              and b.status in :blocking
              and b.startAt < :to
              and b.blockEndAt > :from
            """)
    List<Booking> findBlockingInWindowForProviders(@Param("providerIds") Collection<UUID> providerIds,
                                                   @Param("from") LocalDateTime from,
                                                   @Param("to") LocalDateTime to,
                                                   @Param("blocking") Collection<BookingStatus> blocking);

    @Query("""
            select b from Booking b
            where b.customer.id = :customerId and b.status in :statuses and b.startAt >= :from
            order by b.startAt asc
            """)
    List<Booking> findUpcomingForCustomer(@Param("customerId") UUID customerId,
                                          @Param("statuses") Collection<BookingStatus> statuses,
                                          @Param("from") LocalDateTime from);

    @Query("""
            select b from Booking b
            where b.customer.id = :customerId and (b.status in :statuses or b.startAt < :before)
            order by b.startAt desc
            """)
    List<Booking> findHistoryForCustomer(@Param("customerId") UUID customerId,
                                         @Param("statuses") Collection<BookingStatus> statuses,
                                         @Param("before") LocalDateTime before);

    List<Booking> findByProviderIdOrderByStartAtDesc(UUID providerId);

    /** Admin moderation list: the most recent bookings across the whole platform. */
    List<Booking> findTop200ByOrderByCreatedAtDesc();

    List<Booking> findByProviderIdAndStatusOrderByStartAtAsc(UUID providerId, BookingStatus status);

    long countByProviderIdAndStatus(UUID providerId, BookingStatus status);

    long countByCustomerIdAndStatus(UUID customerId, BookingStatus status);

    /** Any booking at all, used to decide whether an account can be deleted. */
    long countByCustomerId(UUID customerId);

    @Query("""
            select b from Booking b
            where b.provider.id = :providerId and b.startAt >= :from and b.startAt < :to
            order by b.startAt asc
            """)
    List<Booking> findForProviderBetween(@Param("providerId") UUID providerId,
                                         @Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to);

    @Query("select coalesce(sum(b.providerPayoutCents), 0) from Booking b " +
           "where b.provider.id = :providerId and b.status = app.campusconnect.domain.BookingStatus.COMPLETED")
    long sumProviderEarnings(@Param("providerId") UUID providerId);

    @Query("select coalesce(sum(b.priceCents), 0) from Booking b " +
           "where b.customer.id = :customerId and b.status = app.campusconnect.domain.BookingStatus.COMPLETED")
    long sumCustomerSpend(@Param("customerId") UUID customerId);

    @Query("select coalesce(sum(b.platformFeeCents), 0) from Booking b where b.status = :status")
    long sumPlatformRevenue(@Param("status") BookingStatus status);

    @Query("select coalesce(sum(b.priceCents), 0) from Booking b where b.status <> :excluded")
    long sumGrossVolume(@Param("excluded") BookingStatus excluded);
}
