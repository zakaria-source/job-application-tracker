package dev.jobtrackr.security;

import java.time.Instant;

public record IssuedToken(String value, Instant expiresAt) {
}
