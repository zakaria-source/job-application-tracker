package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "follow_up")
public class FollowUpEntity {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private JobApplicationEntity application;
    @Column(name = "scheduled_for", nullable = false) private LocalDate scheduledFor;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private FollowUpStatus status;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected FollowUpEntity() {}
    public FollowUpEntity(UUID id, JobApplicationEntity application, LocalDate scheduledFor, Instant now) {
        this.id = id; this.application = application; this.scheduledFor = scheduledFor;
        this.status = FollowUpStatus.PLANNED; this.createdAt = now; this.updatedAt = now;
    }
    public void refresh(LocalDate today, Instant now) {
        if (status == FollowUpStatus.COMPLETED || status == FollowUpStatus.CANCELLED) return;
        status = scheduledFor.isBefore(today) ? FollowUpStatus.OVERDUE : scheduledFor.equals(today) ? FollowUpStatus.DUE : FollowUpStatus.PLANNED;
        updatedAt = now;
    }
    public void complete(Instant now) { status = FollowUpStatus.COMPLETED; completedAt = now; updatedAt = now; }
    public void snooze(LocalDate date, Instant now) { scheduledFor = date; status = FollowUpStatus.PLANNED; completedAt = null; updatedAt = now; }
    public void cancel(Instant now) { status = FollowUpStatus.CANCELLED; updatedAt = now; }
    public UUID getId() { return id; }
    public LocalDate getScheduledFor() { return scheduledFor; }
    public FollowUpStatus getStatus() { return status; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
