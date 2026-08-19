package dev.jobtrackr.mailtracking.dto;

import dev.jobtrackr.application.domain.RecruitmentStage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record EmailApplyRequest(
    @NotNull UUID applicationId,
    RecruitmentStage stage,
    @NotBlank @Size(max = 80) String signalType,
    @NotBlank @Size(max = 300) String subject
) {}
