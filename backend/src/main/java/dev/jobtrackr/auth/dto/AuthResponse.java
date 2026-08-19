package dev.jobtrackr.auth.dto;

import java.time.Instant;

public record AuthResponse(Instant expiresAt, Instant sessionExpiresAt, UserResponse user) {
}
