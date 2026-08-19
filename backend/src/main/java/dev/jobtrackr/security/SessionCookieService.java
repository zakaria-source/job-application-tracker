package dev.jobtrackr.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class SessionCookieService {

    public static final String ACCESS_COOKIE_NAME = "jobtrackr_session";
    public static final String REFRESH_COOKIE_NAME = "jobtrackr_refresh";
    // Backward-compatible alias used by existing tests and clients.
    public static final String COOKIE_NAME = ACCESS_COOKIE_NAME;

    private final JwtProperties properties;

    public SessionCookieService(JwtProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie issue(IssuedToken token) {
        return issueAccess(token);
    }

    public ResponseCookie issueAccess(IssuedToken token) {
        return cookie(ACCESS_COOKIE_NAME, token.value(), "/api", token.expiresAt());
    }

    public ResponseCookie issueRefresh(IssuedRefreshToken token) {
        return cookie(REFRESH_COOKIE_NAME, token.value(), "/api/v1/auth", token.expiresAt());
    }

    public ResponseCookie clear() {
        return clearAccess();
    }

    public ResponseCookie clearAccess() {
        return clearedCookie(ACCESS_COOKIE_NAME, "/api");
    }

    public ResponseCookie clearRefresh() {
        return clearedCookie(REFRESH_COOKIE_NAME, "/api/v1/auth");
    }

    public String resolve(HttpServletRequest request) {
        return resolveCookie(request, ACCESS_COOKIE_NAME);
    }

    public String resolveRefresh(HttpServletRequest request) {
        return resolveCookie(request, REFRESH_COOKIE_NAME);
    }

    private ResponseCookie cookie(String name, String value, String path, Instant expiresAt) {
        Duration remaining = Duration.between(Instant.now(), expiresAt);
        if (remaining.isNegative()) {
            remaining = Duration.ZERO;
        }
        return ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(properties.secureCookies())
            .sameSite("Strict")
            .path(path)
            .maxAge(remaining)
            .build();
    }

    private ResponseCookie clearedCookie(String name, String path) {
        return ResponseCookie.from(name, "")
            .httpOnly(true)
            .secure(properties.secureCookies())
            .sameSite("Strict")
            .path(path)
            .maxAge(Duration.ZERO)
            .build();
    }

    private static String resolveCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
