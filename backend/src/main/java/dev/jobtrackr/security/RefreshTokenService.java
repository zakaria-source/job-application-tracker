package dev.jobtrackr.security;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
public class RefreshTokenService {
    private static final int SECRET_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();
    private final JwtProperties properties;

    public RefreshTokenService(JwtProperties properties) {
        this.properties = properties;
    }

    public IssuedRefreshToken issue(UUID sessionId) {
        byte[] secret = new byte[SECRET_BYTES];
        secureRandom.nextBytes(secret);
        String encodedSecret = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        String value = sessionId + "." + encodedSecret;
        return new IssuedRefreshToken(
            sessionId,
            value,
            hash(value),
            Instant.now().plus(properties.refreshTtl())
        );
    }

    public ParsedRefreshToken parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing refresh token");
        }
        int separator = value.indexOf('.');
        if (separator <= 0 || separator == value.length() - 1) {
            throw new IllegalArgumentException("Malformed refresh token");
        }
        try {
            UUID sessionId = UUID.fromString(value.substring(0, separator));
            return new ParsedRefreshToken(sessionId, hash(value));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Malformed refresh token", exception);
        }
    }

    public boolean matches(String expectedHash, String presentedHash) {
        return MessageDigest.isEqual(
            expectedHash.getBytes(StandardCharsets.US_ASCII),
            presentedHash.getBytes(StandardCharsets.US_ASCII)
        );
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record ParsedRefreshToken(UUID sessionId, String hash) {
    }
}
