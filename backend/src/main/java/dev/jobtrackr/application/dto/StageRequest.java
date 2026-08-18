package dev.jobtrackr.application.dto;

import dev.jobtrackr.domain.RecruitmentStage;
import jakarta.validation.constraints.NotNull;

public record StageRequest(@NotNull RecruitmentStage stage) {
}
