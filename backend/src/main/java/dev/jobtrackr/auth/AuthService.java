package dev.jobtrackr.auth;

import dev.jobtrackr.auth.dto.AuthResponse;
import dev.jobtrackr.auth.dto.LoginRequest;
import dev.jobtrackr.auth.dto.RegisterRequest;
import dev.jobtrackr.auth.dto.UserResponse;
import dev.jobtrackr.auth.exception.DuplicateEmailException;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import dev.jobtrackr.profile.UserProfileEntity;
import dev.jobtrackr.profile.UserProfileRepository;
import dev.jobtrackr.security.IssuedToken;
import dev.jobtrackr.security.TokenService;
import dev.jobtrackr.identity.UserAccountEntity;
import dev.jobtrackr.identity.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserAccountRepository users;
    private final UserProfileRepository profiles;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;

    public AuthService(UserAccountRepository users,
                       UserProfileRepository profiles,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       TokenService tokenService) {
        this.users = users;
        this.profiles = profiles;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenService = tokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
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
        return createAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.password()));
        UserAccountEntity user = users.findByEmailIgnoreCase(email).orElseThrow(ResourceNotFoundException::new);
        log.info("auth_event action=login_success userId={}", user.getId());
        return createAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(UUID userId) {
        return users.findById(userId)
            .map(AuthService::toUserResponse)
            .orElseThrow(ResourceNotFoundException::new);
    }

    private AuthResponse createAuthResponse(UserAccountEntity user) {
        IssuedToken token = tokenService.issue(user);
        return new AuthResponse(token.value(), token.expiresAt(), toUserResponse(user));
    }

    private static UserResponse toUserResponse(UserAccountEntity user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
