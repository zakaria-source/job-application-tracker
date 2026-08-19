package dev.jobtrackr.gmail.dto;

import java.time.Instant;

public record GmailStatusResponse(
    boolean available,
    boolean connected,
    String emailAddress,
    Instant lastSyncAt,
    String lastError,
    long syncDelayMs
) {}
