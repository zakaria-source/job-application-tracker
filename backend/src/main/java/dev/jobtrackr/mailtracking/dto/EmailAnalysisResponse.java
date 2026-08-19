package dev.jobtrackr.mailtracking.dto;

import dev.jobtrackr.application.domain.RecruitmentStage;
import java.util.List;

public record EmailAnalysisResponse(
    String signalType,
    RecruitmentStage suggestedStage,
    int signalConfidence,
    String summary,
    List<String> evidence,
    List<EmailApplicationMatch> matches
) {}
