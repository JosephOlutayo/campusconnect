package app.campusconnect.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A trust-and-safety report. {@code targetUserId} is denormalised so an admin
 * can suspend the account behind a reported review or listing without chasing
 * the target through three tables.
 */
@Entity
@Table(name = "reports", indexes = {
        @Index(name = "idx_report_status", columnList = "status"),
        @Index(name = "idx_report_target_user", columnList = "target_user_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    /** USER | PROVIDER | SERVICE | REVIEW | MESSAGE */
    @Column(nullable = false, length = 20)
    private String targetType;

    @Column(nullable = false)
    private UUID targetId;

    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Column(nullable = false, length = 120)
    private String reason;

    @Column(length = 2000)
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ReportStatus status = ReportStatus.OPEN;

    @Column(length = 1000)
    private String resolutionNote;

    private Instant resolvedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Report(User reporter, String targetType, UUID targetId, UUID targetUserId,
                  String reason, String details) {
        this.reporter = reporter;
        this.targetType = targetType;
        this.targetId = targetId;
        this.targetUserId = targetUserId;
        this.reason = reason;
        this.details = details;
    }
}
