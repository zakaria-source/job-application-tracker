package dev.jobtrackr.application.tracking.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record FollowUpRequest(@NotNull LocalDate scheduledFor) {}
