package dev.jobtrackr.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class SessionCookieService {

    public static final String COOKIE_NAME = "jobtrackr_session";

    private final JwtProperties properties;

    public SessionCookieService(JwtProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie issue(IssuedToken token) {
        Duration remaining = Duration.between(Instant.now(), token.expiresAt());
        if (remaining.isNegative()) {
            remaining = Duration.ZERO;
        }

        return ResponseCookie.from(COOKIE_NAME, token.value())
            .httpOnly(true)
            .secure(properties.secureCookies())
            .sameSite("Strict")
            .path("/api")
            .maxAge(remaining)
            .build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(COOKIE_NAME, "")
            .httpOnly(true)
            .secure(properties.secureCookies())
            .sameSite("Strict")
            .path("/api")
            .maxAge(Duration.ZERO)
            .build();
    }

    public String resolve(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
