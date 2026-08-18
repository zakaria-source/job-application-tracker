package dev.jobtrackr.application.tracking.dto;

import dev.jobtrackr.application.tracking.ApplicationEventType;
import java.time.Instant;
import java.util.UUID;

public record ApplicationEventResponse(UUID id, ApplicationEventType type, String title, String details, Instant createdAt) {}
