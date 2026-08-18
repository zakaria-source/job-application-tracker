package dev.jobtrackr.application.tracking.dto;

import jakarta.validation.constraints.Size;

public record InterviewDebriefRequest(
    @Size(max = 30) String sentiment,
    @Size(max = 5000) String questions,
    @Size(max = 5000) String strengths,
    @Size(max = 5000) String improvements,
    @Size(max = 2000) String nextAction
) {}
