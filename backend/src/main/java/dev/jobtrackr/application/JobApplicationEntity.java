package dev.jobtrackr.application;

import dev.jobtrackr.application.domain.ApplicationPriority;
import dev.jobtrackr.application.domain.ApplicationStatus;
import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.domain.SalaryPeriod;
import dev.jobtrackr.application.interview.InterviewEntity;
import dev.jobtrackr.identity.UserAccountEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "job_application")
public class JobApplicationEntity {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private UserAccountEntity owner;
    @Column(nullable = false, length = 180) private String company;
    @Column(nullable = false, length = 220) private String position;
    @Column(name = "application_date", nullable = false) private LocalDate applicationDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40) private ApplicationStatus status;
    @Column(nullable = false, columnDefinition = "text") private String notes = "";
    @Column(name = "last_updated", nullable = false) private Instant lastUpdated;
    @Column(name = "response_date") private LocalDate responseDate;
    @Column(name = "offer_url", columnDefinition = "text") private String offerUrl;
    @Enumerated(EnumType.STRING) @Column(name = "contract_type", nullable = false, length = 40) private ContractType contractType;
    @Column(name = "salary_target", precision = 14, scale = 2) private BigDecimal salaryTarget;
    @Enumerated(EnumType.STRING) @Column(name = "salary_period", nullable = false, length = 40) private SalaryPeriod salaryPeriod;
    @Column(name = "follow_up_date") private LocalDate followUpDate;
    @Column(name = "recruiter_name", length = 180) private String recruiterName;
    @Column(name = "recruiter_email", length = 320) private String recruiterEmail;
    @Column(name = "recruiter_phone", length = 80) private String recruiterPhone;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 60) private RecruitmentStage stage;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private ApplicationPriority priority;
    @Version @Column(nullable = false) private long version;
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true) @OrderBy("date ASC") private List<InterviewEntity> interviews = new ArrayList<>();

    protected JobApplicationEntity() {}
    public JobApplicationEntity(UUID id, UserAccountEntity owner) { this.id = id; this.owner = owner; }

    public void update(String company, String position, LocalDate applicationDate, String notes, LocalDate responseDate,
                       String offerUrl, ContractType contractType, BigDecimal salaryTarget, SalaryPeriod salaryPeriod,
                       LocalDate followUpDate, String recruiterName, String recruiterEmail, String recruiterPhone,
                       RecruitmentStage stage, ApplicationPriority priority, Instant now) {
        this.company = company.trim(); this.position = position.trim(); this.applicationDate = applicationDate;
        this.stage = stage; this.status = stage.impliedStatus(); this.notes = notes == null ? "" : notes;
        this.responseDate = responseDate; this.offerUrl = blankToNull(offerUrl); this.contractType = contractType;
        this.salaryTarget = salaryTarget; this.salaryPeriod = salaryPeriod; this.followUpDate = followUpDate;
        this.recruiterName = blankToNull(recruiterName); this.recruiterEmail = blankToNull(recruiterEmail);
        this.recruiterPhone = blankToNull(recruiterPhone); this.priority = priority; this.lastUpdated = now;
    }
    public void moveTo(RecruitmentStage stage, Instant now) {
        this.stage = stage; this.status = stage.impliedStatus(); this.lastUpdated = now;
        if (stage == RecruitmentStage.OFFRE || stage == RecruitmentStage.CLOTURE) this.responseDate = this.responseDate == null ? LocalDate.now() : this.responseDate;
    }
    public void scheduleFollowUp(LocalDate date, Instant now) { this.followUpDate = date; this.lastUpdated = now; }
    public void clearFollowUp(Instant now) { this.followUpDate = null; this.lastUpdated = now; }
    public void touch(Instant now) { this.lastUpdated = now; }
    public void addInterview(InterviewEntity interview, Instant now) { interviews.add(interview); this.lastUpdated = now; }

    public UUID getId() { return id; } public String getCompany() { return company; } public String getPosition() { return position; }
    public LocalDate getApplicationDate() { return applicationDate; } public ApplicationStatus getStatus() { return status; }
    public String getNotes() { return notes; } public Instant getLastUpdated() { return lastUpdated; } public LocalDate getResponseDate() { return responseDate; }
    public String getOfferUrl() { return offerUrl; } public ContractType getContractType() { return contractType; } public BigDecimal getSalaryTarget() { return salaryTarget; }
    public SalaryPeriod getSalaryPeriod() { return salaryPeriod; } public LocalDate getFollowUpDate() { return followUpDate; }
    public String getRecruiterName() { return recruiterName; } public String getRecruiterEmail() { return recruiterEmail; } public String getRecruiterPhone() { return recruiterPhone; }
    public RecruitmentStage getStage() { return stage; } public ApplicationPriority getPriority() { return priority; }
    public List<InterviewEntity> getInterviews() { return interviews; } public long getVersion() { return version; }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
