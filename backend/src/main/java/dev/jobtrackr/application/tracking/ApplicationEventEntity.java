package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "application_event")
public class ApplicationEventEntity {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private JobApplicationEntity application;
    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 50)
    private ApplicationEventType type;
    @Column(nullable = false, length = 180) private String title;
    @Column(nullable = false, columnDefinition = "text") private String details = "";
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected ApplicationEventEntity() {}
    public ApplicationEventEntity(UUID id, JobApplicationEntity application, ApplicationEventType type, String title, String details, Instant createdAt) {
        this.id = id; this.application = application; this.type = type; this.title = title;
        this.details = details == null ? "" : details; this.createdAt = createdAt;
    }
    public UUID getId() { return id; }
    public ApplicationEventType getType() { return type; }
    public String getTitle() { return title; }
    public String getDetails() { return details; }
    public Instant getCreatedAt() { return createdAt; }
}
