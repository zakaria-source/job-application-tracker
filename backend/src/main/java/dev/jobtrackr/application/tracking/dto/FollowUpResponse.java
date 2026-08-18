package dev.jobtrackr.application.tracking.dto;

import dev.jobtrackr.application.tracking.FollowUpStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FollowUpResponse(UUID id, LocalDate scheduledFor, FollowUpStatus status, Instant completedAt, Instant createdAt, Instant updatedAt) {}
