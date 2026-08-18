package dev.jobtrackr.application.interview.dto;

import dev.jobtrackr.application.interview.InterviewType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InterviewResponse(
    UUID id,
    OffsetDateTime date,
    InterviewType type,
    String notes,
    boolean reminderSet
) {
}
