package dev.jobtrackr.application.tracking.dto;

import java.time.Instant;
import java.util.UUID;

public record InterviewDebriefResponse(UUID id, UUID interviewId, String sentiment, String questions, String strengths, String improvements, String nextAction, Instant updatedAt) {}
