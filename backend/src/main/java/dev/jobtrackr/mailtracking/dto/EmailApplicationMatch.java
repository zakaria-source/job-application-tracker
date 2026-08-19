package dev.jobtrackr.mailtracking.dto;

import dev.jobtrackr.application.domain.RecruitmentStage;
import java.util.List;
import java.util.UUID;

public record EmailApplicationMatch(
    UUID applicationId,
    String company,
    String position,
    RecruitmentStage currentStage,
    int score,
    List<String> reasons
) {}
