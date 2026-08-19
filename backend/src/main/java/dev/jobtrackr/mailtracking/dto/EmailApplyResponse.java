package dev.jobtrackr.mailtracking.dto;

import dev.jobtrackr.application.domain.RecruitmentStage;
import java.util.UUID;

public record EmailApplyResponse(
    UUID applicationId,
    RecruitmentStage stage,
    String message
) {}
