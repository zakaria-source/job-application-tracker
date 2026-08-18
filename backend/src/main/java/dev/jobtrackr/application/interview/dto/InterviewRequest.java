package dev.jobtrackr.application.interview.dto;

import dev.jobtrackr.application.interview.InterviewType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InterviewRequest(
    UUID id,
    @NotNull OffsetDateTime date,
    @NotNull InterviewType type,
    @Size(max = 8000) String notes,
    boolean reminderSet
) {
}
