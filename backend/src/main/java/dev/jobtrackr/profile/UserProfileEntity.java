package dev.jobtrackr.profile;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "user_profile")
public class UserProfileEntity implements Persistable<UUID> {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 180)
    private String headline = "";

    @Column(name = "experience_label", nullable = false, length = 120)
    private String experienceLabel = "";

    @Column(nullable = false, length = 180)
    private String location = "";

    @Column(nullable = false, columnDefinition = "text")
    private String summary = "";

    @ElementCollection
    @CollectionTable(name = "user_profile_skill", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "skill_order")
    @Column(name = "skill", nullable = false, length = 120)
    private List<String> coreSkills = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "user_profile_certification", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "certification_order")
    @Column(name = "certification", nullable = false, length = 180)
    private List<String> certifications = new ArrayList<>();

    @Column(nullable = false, length = 240)
    private String education = "";

    @Column(name = "target_compensation", nullable = false, length = 120)
    private String targetCompensation = "";

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Transient
    private boolean newEntity = true;

    protected UserProfileEntity() {
    }

    public UserProfileEntity(UUID userId, Instant now) {
        this.userId = userId;
        this.updatedAt = now;
    }

    @Override
    public UUID getId() {
        return userId;
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.newEntity = false;
    }

    public String getHeadline() { return headline; }
    public String getExperienceLabel() { return experienceLabel; }
    public String getLocation() { return location; }
    public String getSummary() { return summary; }
    public List<String> getCoreSkills() { return List.copyOf(coreSkills); }
    public List<String> getCertifications() { return List.copyOf(certifications); }
    public String getEducation() { return education; }
    public String getTargetCompensation() { return targetCompensation; }

    public void update(String headline,
                       String experienceLabel,
                       String location,
                       String summary,
                       List<String> coreSkills,
                       List<String> certifications,
                       String education,
                       String targetCompensation,
                       Instant now) {
        this.headline = normalize(headline);
        this.experienceLabel = normalize(experienceLabel);
        this.location = normalize(location);
        this.summary = normalize(summary);
        this.coreSkills.clear();
        this.coreSkills.addAll(coreSkills == null ? List.of() : coreSkills);
        this.certifications.clear();
        this.certifications.addAll(certifications == null ? List.of() : certifications);
        this.education = normalize(education);
        this.targetCompensation = normalize(targetCompensation);
        this.updatedAt = now;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
