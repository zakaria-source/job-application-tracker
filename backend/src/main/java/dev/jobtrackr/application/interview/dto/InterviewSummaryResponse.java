package dev.jobtrackr.application.interview.dto;

import dev.jobtrackr.application.interview.InterviewType;

import java.time.Instant;
import java.util.UUID;

public record InterviewSummaryResponse(
    UUID id,
    Instant date,
    InterviewType type,
    boolean reminderSet
) {
}
