package dev.jobtrackr.security;

import java.time.Instant;
import java.util.UUID;

public record IssuedRefreshToken(UUID sessionId, String value, String hash, Instant expiresAt) {
}
