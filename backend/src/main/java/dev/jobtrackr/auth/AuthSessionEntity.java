package dev.jobtrackr.auth;

import dev.jobtrackr.identity.UserAccountEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_session")
class AuthSessionEntity {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccountEntity user;

    @Column(name = "refresh_token_hash", nullable = false, length = 64)
    private String refreshTokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_used_at", nullable = false)
    private Instant lastUsedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected AuthSessionEntity() {
    }

    AuthSessionEntity(UUID id, UserAccountEntity user, String refreshTokenHash, Instant expiresAt, Instant now) {
        this.id = id;
        this.user = user;
        this.refreshTokenHash = refreshTokenHash;
        this.createdAt = now;
        this.expiresAt = expiresAt;
        this.lastUsedAt = now;
    }

    UUID getId() { return id; }
    UserAccountEntity getUser() { return user; }
    String getRefreshTokenHash() { return refreshTokenHash; }
    Instant getExpiresAt() { return expiresAt; }
    Instant getRevokedAt() { return revokedAt; }

    boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    void rotate(String tokenHash, Instant newExpiresAt, Instant now) {
        this.refreshTokenHash = tokenHash;
        this.expiresAt = newExpiresAt;
        this.lastUsedAt = now;
    }

    void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
            lastUsedAt = now;
        }
    }
}
