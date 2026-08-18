package dev.jobtrackr.auth;

import dev.jobtrackr.profile.UserProfileEntity;
import dev.jobtrackr.profile.UserProfileRepository;
import dev.jobtrackr.security.CurrentUser;
import dev.jobtrackr.security.TokenService;
import dev.jobtrackr.user.UserAccountEntity;
import dev.jobtrackr.user.UserAccountRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserAccountRepository users;
    private final UserProfileRepository profiles;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;

    public AuthController(UserAccountRepository users,
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

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
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
        profiles.save(new UserProfileEntity(user, now));
        return response(user);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        String email = normalizeEmail(request.email());
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.password()));
        UserAccountEntity user = users.findByEmailIgnoreCase(email).orElseThrow();
        return response(user);
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        UserAccountEntity user = users.findById(CurrentUser.id(jwt)).orElseThrow();
        return UserResponse.from(user);
    }

    private AuthResponse response(UserAccountEntity user) {
        TokenService.Token token = tokenService.issue(user);
        return new AuthResponse(token.value(), token.expiresAt(), UserResponse.from(user));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(min = 10, max = 100) String password,
        @NotBlank @Size(max = 120) String displayName
    ) {
    }

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {
    }

    public record AuthResponse(String accessToken, Instant expiresAt, UserResponse user) {
    }

    public record UserResponse(UUID id, String email, String displayName) {
        static UserResponse from(UserAccountEntity user) {
            return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
        }
    }

    public static class DuplicateEmailException extends RuntimeException {
    }
}
