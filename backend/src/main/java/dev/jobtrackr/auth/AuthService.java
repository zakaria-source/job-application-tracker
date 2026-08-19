package dev.jobtrackr.auth;

import dev.jobtrackr.auth.dto.LoginRequest;
import dev.jobtrackr.auth.dto.RegisterRequest;
import dev.jobtrackr.auth.dto.UserResponse;
import dev.jobtrackr.auth.exception.DuplicateEmailException;
import dev.jobtrackr.common.RateLimitService;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import dev.jobtrackr.identity.UserAccountEntity;
import dev.jobtrackr.identity.UserAccountRepository;
import dev.jobtrackr.profile.UserProfileEntity;
import dev.jobtrackr.profile.UserProfileRepository;
import dev.jobtrackr.security.IssuedRefreshToken;
import dev.jobtrackr.security.IssuedToken;
import dev.jobtrackr.security.RefreshTokenService;
import dev.jobtrackr.security.TokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(1);
    private static final Duration REGISTER_WINDOW = Duration.ofHours(1);
    private static final Duration REFRESH_WINDOW = Duration.ofMinutes(1);

    private final UserAccountRepository users;
    private final UserProfileRepository profiles;
    private final AuthSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;
    private final RefreshTokenService refreshTokens;
    private final RateLimitService rateLimits;

    public AuthService(UserAccountRepository users,
                       UserProfileRepository profiles,
                       AuthSessionRepository sessions,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       TokenService tokenService,
                       RefreshTokenService refreshTokens,
                       RateLimitService rateLimits) {
        this.users = users;
        this.profiles = profiles;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenService = tokenService;
        this.refreshTokens = refreshTokens;
        this.rateLimits = rateLimits;
    }

    @Transactional
    public AuthResult register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        rateLimits.check("register:" + email, 5, REGISTER_WINDOW);
        if (users.existsByEmailIgnoreCase(email)) {
            throw new DuplicateEmailException();
        }

        Instant now = Instant.now();
        UserAccountEntity user = new UserAccountEntity(
            UUID.randomUUID(),
            email,
            passwordEncoder.encode(request.password()),
            request.displayName().trim(),
            now
        );

        users.save(user);
        profiles.save(new UserProfileEntity(user.getId(), now));
        log.info("auth_event action=register_success userId={}", user.getId());
        return createAuthResult(user, now);
    }

    @Transactional
    public AuthResult login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        String rateKey = "login:" + email;
        rateLimits.check(rateKey, 10, LOGIN_WINDOW);
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.password()));
        UserAccountEntity user = users.findByEmailIgnoreCase(email).orElseThrow(ResourceNotFoundException::new);
        rateLimits.reset(rateKey);
        log.info("auth_event action=login_success userId={}", user.getId());
        return createAuthResult(user, Instant.now());
    }

    /**
     * Refresh rotation is serialized per auth session with a database row lock.
     * A replay revokes that locked session and the dedicated exception is configured
     * not to roll the revocation back when the request is rejected with 401.
     */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public AuthResult refresh(String rawRefreshToken) {
        RefreshTokenService.ParsedRefreshToken presented = parseRefresh(rawRefreshToken);
        rateLimits.check("refresh:" + presented.sessionId(), 30, REFRESH_WINDOW);
        AuthSessionEntity session = sessions.findByIdForUpdate(presented.sessionId())
            .orElseThrow(AuthService::invalidRefreshToken);
        Instant now = Instant.now();

        if (!session.isActive(now)) {
            throw invalidRefreshToken();
        }
        if (!refreshTokens.matches(session.getRefreshTokenHash(), presented.hash())) {
            session.revoke(now);
            sessions.saveAndFlush(session);
            log.warn("auth_event action=refresh_reuse_detected sessionId={} userId={}", session.getId(), session.getUser().getId());
            throw invalidRefreshToken();
        }

        IssuedRefreshToken rotated = refreshTokens.issue(session.getId());
        session.rotate(rotated.hash(), rotated.expiresAt(), now);
        sessions.saveAndFlush(session);
        IssuedToken access = tokenService.issue(session.getUser());
        log.info("auth_event action=refresh_success sessionId={} userId={}", session.getId(), session.getUser().getId());
        return new AuthResult(access, rotated, toUserResponse(session.getUser()));
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        try {
            RefreshTokenService.ParsedRefreshToken presented = refreshTokens.parse(rawRefreshToken);
            sessions.findByIdForUpdate(presented.sessionId()).ifPresent(session -> {
                if (refreshTokens.matches(session.getRefreshTokenHash(), presented.hash())) {
                    session.revoke(Instant.now());
                    sessions.saveAndFlush(session);
                    log.info("auth_event action=logout_success sessionId={} userId={}", session.getId(), session.getUser().getId());
                }
            });
        } catch (IllegalArgumentException ignored) {
            // Logout is idempotent; malformed or stale refresh cookies are simply cleared by the controller.
        }
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(UUID userId) {
        return users.findById(userId)
            .map(AuthService::toUserResponse)
            .orElseThrow(ResourceNotFoundException::new);
    }

    private AuthResult createAuthResult(UserAccountEntity user, Instant now) {
        UUID sessionId = UUID.randomUUID();
        IssuedRefreshToken refresh = refreshTokens.issue(sessionId);
        sessions.save(new AuthSessionEntity(sessionId, user, refresh.hash(), refresh.expiresAt(), now));
        return new AuthResult(tokenService.issue(user), refresh, toUserResponse(user));
    }

    private RefreshTokenService.ParsedRefreshToken parseRefresh(String rawRefreshToken) {
        try {
            return refreshTokens.parse(rawRefreshToken);
        } catch (IllegalArgumentException exception) {
            throw invalidRefreshToken();
        }
    }

    private static InvalidRefreshTokenException invalidRefreshToken() {
        return new InvalidRefreshTokenException();
    }

    private static UserResponse toUserResponse(UserAccountEntity user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
