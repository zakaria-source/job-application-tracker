package dev.jobtrackr.auth;

import dev.jobtrackr.auth.dto.AuthResponse;
import dev.jobtrackr.auth.dto.LoginRequest;
import dev.jobtrackr.auth.dto.RegisterRequest;
import dev.jobtrackr.auth.dto.UserResponse;
import dev.jobtrackr.security.CurrentUser;
import dev.jobtrackr.security.SessionCookieService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final SessionCookieService sessionCookies;

    public AuthController(AuthService authService, SessionCookieService sessionCookies) {
        this.authService = authService;
        this.sessionCookies = sessionCookies;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return authenticated(authService.register(request), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return authenticated(authService.login(request), HttpStatus.OK);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request) {
        return authenticated(authService.refresh(sessionCookies.resolveRefresh(request)), HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(sessionCookies.resolveRefresh(request));
        return ResponseEntity.noContent()
            .headers(headers -> {
                headers.add(HttpHeaders.SET_COOKIE, sessionCookies.clearAccess().toString());
                headers.add(HttpHeaders.SET_COOKIE, sessionCookies.clearRefresh().toString());
            })
            .build();
    }

    @GetMapping("/csrf")
    public CsrfToken csrf(CsrfToken token) {
        return token;
    }

    @GetMapping("/capabilities")
    public Map<String, Object> capabilities() {
        return Map.of(
            "version", "cookie-refresh-v1",
            "httpOnlyAccessCookie", true,
            "refreshRotation", true,
            "csrfTokenEndpoint", "/api/v1/auth/csrf",
            "csrfEnforced", false
        );
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.getUser(CurrentUser.id(jwt));
    }

    private ResponseEntity<AuthResponse> authenticated(AuthResult result, HttpStatus status) {
        AuthResponse response = new AuthResponse(
            result.token().expiresAt(),
            result.refreshToken().expiresAt(),
            result.user()
        );
        return ResponseEntity.status(status)
            .headers(headers -> {
                headers.add(HttpHeaders.SET_COOKIE, sessionCookies.issueAccess(result.token()).toString());
                headers.add(HttpHeaders.SET_COOKIE, sessionCookies.issueRefresh(result.refreshToken()).toString());
            })
            .body(response);
    }
}
