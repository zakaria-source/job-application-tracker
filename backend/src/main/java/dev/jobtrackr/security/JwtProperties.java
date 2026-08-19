package dev.jobtrackr.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "jobtrackr.security")
public record JwtProperties(
    String jwtSecret,
    Duration tokenTtl,
    Duration refreshTtl,
    List<String> allowedOrigins,
    boolean secureCookies
) {
}
