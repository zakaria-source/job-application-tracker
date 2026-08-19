package dev.jobtrackr.gmail;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "gmail_processed_message")
class GmailProcessedMessageEntity {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "connection_id", nullable = false)
    private GmailConnectionEntity connection;

    @Column(name = "message_id", nullable = false, length = 128)
    private String messageId;

    @Column(name = "thread_id", length = 128)
    private String threadId;

    @Column(name = "message_date")
    private Instant messageDate;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    @Column(name = "matched_application_id")
    private UUID matchedApplicationId;

    @Column(name = "signal_type", length = 80)
    private String signalType;

    @Column(name = "match_score")
    private Integer matchScore;

    @Column(name = "auto_applied", nullable = false)
    private boolean autoApplied;

    protected GmailProcessedMessageEntity() {}

    GmailProcessedMessageEntity(
        UUID id,
        GmailConnectionEntity connection,
        String messageId,
        String threadId,
        Instant messageDate,
        Instant processedAt,
        UUID matchedApplicationId,
        String signalType,
        Integer matchScore,
        boolean autoApplied
    ) {
        this.id = id;
        this.connection = connection;
        this.messageId = messageId;
        this.threadId = threadId;
        this.messageDate = messageDate;
        this.processedAt = processedAt;
        this.matchedApplicationId = matchedApplicationId;
        this.signalType = signalType;
        this.matchScore = matchScore;
        this.autoApplied = autoApplied;
    }

    boolean isAutoApplied() {
        return autoApplied;
    }

    UUID getMatchedApplicationId() {
        return matchedApplicationId;
    }
}
