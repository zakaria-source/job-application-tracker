package dev.jobtrackr.application.interview.dto;

import dev.jobtrackr.application.interview.InterviewType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InterviewSummaryResponse(
    UUID id,
    OffsetDateTime date,
    InterviewType type,
    boolean reminderSet
) {
}
