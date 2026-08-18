package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.interview.InterviewEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_debrief")
public class InterviewDebriefEntity {
    @Id private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "interview_id", nullable = false, unique = true)
    private InterviewEntity interview;
    @Column(nullable = false, length = 30) private String sentiment;
    @Column(nullable = false, columnDefinition = "text") private String questions = "";
    @Column(nullable = false, columnDefinition = "text") private String strengths = "";
    @Column(nullable = false, columnDefinition = "text") private String improvements = "";
    @Column(name = "next_action", nullable = false, columnDefinition = "text") private String nextAction = "";
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected InterviewDebriefEntity() {}
    public InterviewDebriefEntity(UUID id, InterviewEntity interview) { this.id = id; this.interview = interview; }
    public void update(String sentiment, String questions, String strengths, String improvements, String nextAction, Instant now) {
        this.sentiment = sentiment == null || sentiment.isBlank() ? "NEUTRAL" : sentiment.trim().toUpperCase();
        this.questions = clean(questions); this.strengths = clean(strengths); this.improvements = clean(improvements); this.nextAction = clean(nextAction); this.updatedAt = now;
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    public UUID getId() { return id; }
    public UUID getInterviewId() { return interview.getId(); }
    public String getSentiment() { return sentiment; }
    public String getQuestions() { return questions; }
    public String getStrengths() { return strengths; }
    public String getImprovements() { return improvements; }
    public String getNextAction() { return nextAction; }
    public Instant getUpdatedAt() { return updatedAt; }
}
