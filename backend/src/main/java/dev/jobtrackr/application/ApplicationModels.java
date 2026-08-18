package dev.jobtrackr.application;

import dev.jobtrackr.domain.ApplicationPriority;
import dev.jobtrackr.domain.ApplicationStatus;
import dev.jobtrackr.domain.ContractType;
import dev.jobtrackr.domain.InterviewType;
import dev.jobtrackr.domain.RecruitmentStage;
import dev.jobtrackr.domain.SalaryPeriod;
import dev.jobtrackr.interview.InterviewEntity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class ApplicationModels {

    private ApplicationModels() {
    }

    public record ApplicationRequest(
        @NotBlank @Size(max = 180) String company,
        @NotBlank @Size(max = 220) String position,
        @NotNull LocalDate applicationDate,
        ApplicationStatus status,
        @Size(max = 12000) String notes,
        LocalDate responseDate,
        @Size(max = 4000) String offerUrl,
        @NotNull ContractType contractType,
        @PositiveOrZero BigDecimal salaryTarget,
        @NotNull SalaryPeriod salaryPeriod,
        LocalDate followUpDate,
        @Size(max = 180) String recruiterName,
        @Email @Size(max = 320) String recruiterEmail,
        @Size(max = 80) String recruiterPhone,
        @NotNull RecruitmentStage stage,
        @NotNull ApplicationPriority priority,
        List<@Valid InterviewRequest> interviews
    ) {
    }

    public record StageRequest(@NotNull RecruitmentStage stage) {
    }

    public record InterviewRequest(
        @NotNull OffsetDateTime date,
        @NotNull InterviewType type,
        @Size(max = 8000) String notes,
        boolean reminderSet
    ) {
    }

    public record InterviewResponse(
        UUID id,
        OffsetDateTime date,
        InterviewType type,
        String notes,
        boolean reminderSet
    ) {
        static InterviewResponse from(InterviewEntity interview) {
            return new InterviewResponse(
                interview.getId(),
                interview.getDate(),
                interview.getType(),
                interview.getNotes(),
                interview.isReminderSet()
            );
        }
    }

    public record ApplicationResponse(
        UUID id,
        String company,
        String position,
        LocalDate applicationDate,
        ApplicationStatus status,
        String notes,
        Instant lastUpdated,
        LocalDate responseDate,
        String offerUrl,
        ContractType contractType,
        BigDecimal salaryTarget,
        SalaryPeriod salaryPeriod,
        LocalDate followUpDate,
        String recruiterName,
        String recruiterEmail,
        String recruiterPhone,
        RecruitmentStage stage,
        ApplicationPriority priority,
        List<InterviewResponse> interviews,
        long version
    ) {
        static ApplicationResponse from(JobApplicationEntity application) {
            return new ApplicationResponse(
                application.getId(),
                application.getCompany(),
                application.getPosition(),
                application.getApplicationDate(),
                application.getStatus(),
                application.getNotes(),
                application.getLastUpdated(),
                application.getResponseDate(),
                application.getOfferUrl(),
                application.getContractType(),
                application.getSalaryTarget(),
                application.getSalaryPeriod(),
                application.getFollowUpDate(),
                application.getRecruiterName(),
                application.getRecruiterEmail(),
                application.getRecruiterPhone(),
                application.getStage(),
                application.getPriority(),
                application.getInterviews().stream().map(InterviewResponse::from).toList(),
                application.getVersion()
            );
        }
    }

    public record ImportSummary(int imported, int skipped) {
    }
}
