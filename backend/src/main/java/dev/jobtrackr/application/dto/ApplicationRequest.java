package dev.jobtrackr.application.dto;

import dev.jobtrackr.domain.ApplicationPriority;
import dev.jobtrackr.domain.ApplicationStatus;
import dev.jobtrackr.domain.ContractType;
import dev.jobtrackr.domain.RecruitmentStage;
import dev.jobtrackr.domain.SalaryPeriod;
import dev.jobtrackr.interview.dto.InterviewRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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
