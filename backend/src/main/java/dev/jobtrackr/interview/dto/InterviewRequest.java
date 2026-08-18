package dev.jobtrackr.interview.dto;

import dev.jobtrackr.domain.InterviewType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public record InterviewRequest(
    @NotNull OffsetDateTime date,
    @NotNull InterviewType type,
    @Size(max = 8000) String notes,
    boolean reminderSet
) {
}
