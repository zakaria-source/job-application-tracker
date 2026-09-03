package dev.jobtrackr.application.dto;

import dev.jobtrackr.application.domain.ApplicationPriority;
import dev.jobtrackr.application.domain.ApplicationStatus;
import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.domain.SalaryPeriod;
import dev.jobtrackr.application.interview.dto.InterviewSummaryResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ApplicationSummaryResponse(
    UUID id,
    String company,
    String position,
    LocalDate applicationDate,
    ApplicationStatus status,
    Instant lastUpdated,
    LocalDate responseDate,
    String offerUrl,
    ContractType contractType,
    BigDecimal salaryTarget,
    SalaryPeriod salaryPeriod,
    LocalDate followUpDate,
    String recruiterName,
    RecruitmentStage stage,
    ApplicationPriority priority,
    List<InterviewSummaryResponse> interviews,
    long version
) {
}
