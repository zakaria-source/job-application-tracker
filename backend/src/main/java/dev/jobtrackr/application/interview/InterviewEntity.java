package dev.jobtrackr.application.interview;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.interview.InterviewType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "interview")
public class InterviewEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private JobApplicationEntity application;

    @Column(name = "interview_date", nullable = false)
    private OffsetDateTime date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private InterviewType type;

    @Column(nullable = false, columnDefinition = "text")
    private String notes = "";

    @Column(name = "reminder_set", nullable = false)
    private boolean reminderSet;

    protected InterviewEntity() {
    }

    public InterviewEntity(UUID id, JobApplicationEntity application) {
        this.id = id;
        this.application = application;
    }

    public void update(OffsetDateTime date, InterviewType type, String notes, boolean reminderSet) {
        this.date = date;
        this.type = type;
        this.notes = notes == null ? "" : notes;
        this.reminderSet = reminderSet;
    }

    public UUID getId() { return id; }
    public JobApplicationEntity getApplication() { return application; }
    public OffsetDateTime getDate() { return date; }
    public InterviewType getType() { return type; }
    public String getNotes() { return notes; }
    public boolean isReminderSet() { return reminderSet; }
}
