package dev.jobtrackr.gmail;

import dev.jobtrackr.common.exception.ResourceNotFoundException;
import dev.jobtrackr.gmail.dto.GmailAuthorizationResponse;
import dev.jobtrackr.identity.UserAccountEntity;
import dev.jobtrackr.identity.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
class GmailOAuthService {
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private final GmailProperties properties;
    private final GmailApiClient api;
    private final GmailTokenCipher cipher;
    private final GmailConnectionRepository connections;
    private final GmailOAuthStateRepository states;
    private final UserAccountRepository users;
    private final SecureRandom random = new SecureRandom();

    GmailOAuthService(
        GmailProperties properties,
        GmailApiClient api,
        GmailTokenCipher cipher,
        GmailConnectionRepository connections,
        GmailOAuthStateRepository states,
        UserAccountRepository users
    ) {
        this.properties = properties;
        this.api = api;
        this.cipher = cipher;
        this.connections = connections;
        this.states = states;
        this.users = users;
    }

    @Transactional
    GmailAuthorizationResponse authorizationUrl(UUID userId) {
        requireConfigured();
        UserAccountEntity user = users.findById(userId).orElseThrow(ResourceNotFoundException::new);
        Instant now = Instant.now();
        states.deleteByExpiresAtBefore(now);

        byte[] randomBytes = new byte[32];
        random.nextBytes(randomBytes);
        String rawState = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        states.save(new GmailOAuthStateEntity(
            UUID.randomUUID(),
            user,
            hash(rawState),
            now.plus(STATE_TTL),
            now
        ));

        URI uri = UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
            .queryParam("client_id", properties.getClientId())
            .queryParam("redirect_uri", properties.getRedirectUri())
            .queryParam("response_type", "code")
            .queryParam("scope", api.scope())
            .queryParam("access_type", "offline")
            .queryParam("include_granted_scopes", "true")
            .queryParam("prompt", "consent")
            .queryParam("state", rawState)
            .build(true)
            .toUri();
        return new GmailAuthorizationResponse(uri.toString());
    }

    @Transactional
    URI callback(String code, String state, String oauthError) {
        if (!properties.configured()) return redirect("error", "configuration");
        if (state == null || state.isBlank()) return redirect("error", "state");

        GmailOAuthStateEntity savedState = states.findByStateHash(hash(state)).orElse(null);
        if (savedState == null) return redirect("error", "state");
        states.delete(savedState);
        if (savedState.getExpiresAt().isBefore(Instant.now())) return redirect("error", "expired");
        if (oauthError != null && !oauthError.isBlank()) return redirect("error", "consent");
        if (code == null || code.isBlank()) return redirect("error", "code");

        try {
            GmailApiClient.OAuthTokens tokens = api.exchangeCode(code);
            if (tokens.accessToken().isBlank()) return redirect("error", "token");
            GmailApiClient.GmailProfile profile = api.profile(tokens.accessToken());
            if (profile.emailAddress().isBlank()) return redirect("error", "profile");

            UUID userId = savedState.getOwner().getId();
            GmailConnectionEntity existing = connections.findByOwner_Id(userId).orElse(null);
            String encryptedRefreshToken;
            if (!tokens.refreshToken().isBlank()) {
                encryptedRefreshToken = cipher.encrypt(tokens.refreshToken());
            } else if (existing != null) {
                encryptedRefreshToken = existing.getRefreshTokenCiphertext();
            } else {
                return redirect("error", "refresh_token");
            }

            Instant now = Instant.now();
            if (existing == null) {
                existing = new GmailConnectionEntity(
                    UUID.randomUUID(),
                    savedState.getOwner(),
                    profile.emailAddress(),
                    encryptedRefreshToken,
                    now
                );
            } else {
                existing.reconnect(profile.emailAddress(), encryptedRefreshToken, now);
            }
            connections.save(existing);
            return redirect("connected", null);
        } catch (RuntimeException exception) {
            return redirect("error", "exchange");
        }
    }

    private void requireConfigured() {
        if (!properties.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Gmail integration is not configured");
        }
    }

    private URI redirect(String status, String reason) {
        UriComponentsBuilder builder = UriComponentsBuilder
            .fromUriString(properties.getFrontendBaseUrl())
            .path("/applications")
            .queryParam("gmail", status);
        if (reason != null) builder.queryParam("reason", reason);
        return builder.build(true).toUri();
    }

    private static String hash(String state) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(state.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash OAuth state", exception);
        }
    }
}
