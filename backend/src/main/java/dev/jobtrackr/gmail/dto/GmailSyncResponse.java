package dev.jobtrackr.gmail.dto;

import java.time.Instant;

public record GmailSyncResponse(
    int scanned,
    int matched,
    int applied,
    int ignored,
    boolean fullSync,
    Instant syncedAt
) {}
