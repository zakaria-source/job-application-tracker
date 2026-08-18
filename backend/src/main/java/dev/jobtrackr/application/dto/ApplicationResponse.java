package dev.jobtrackr.application.dto;

import dev.jobtrackr.domain.ApplicationPriority;
import dev.jobtrackr.domain.ApplicationStatus;
import dev.jobtrackr.domain.ContractType;
import dev.jobtrackr.domain.RecruitmentStage;
import dev.jobtrackr.domain.SalaryPeriod;
import dev.jobtrackr.interview.dto.InterviewResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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
}
