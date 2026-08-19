package dev.jobtrackr.gmail;

import dev.jobtrackr.identity.UserAccountEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "gmail_connection")
class GmailConnectionEntity {
    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserAccountEntity owner;

    @Column(name = "email_address", nullable = false, length = 320)
    private String emailAddress;

    @Column(name = "refresh_token_ciphertext", nullable = false, columnDefinition = "text")
    private String refreshTokenCiphertext;

    @Column(name = "history_id", length = 64)
    private String historyId;

    @Column(name = "sync_enabled", nullable = false)
    private boolean syncEnabled;

    @Column(name = "connected_at", nullable = false)
    private Instant connectedAt;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected GmailConnectionEntity() {}

    GmailConnectionEntity(UUID id, UserAccountEntity owner, String emailAddress, String refreshTokenCiphertext, Instant now) {
        this.id = id;
        this.owner = owner;
        this.emailAddress = emailAddress;
        this.refreshTokenCiphertext = refreshTokenCiphertext;
        this.syncEnabled = true;
        this.connectedAt = now;
        this.updatedAt = now;
    }

    void reconnect(String emailAddress, String refreshTokenCiphertext, Instant now) {
        this.emailAddress = emailAddress;
        this.refreshTokenCiphertext = refreshTokenCiphertext;
        this.historyId = null;
        this.syncEnabled = true;
        this.lastError = null;
        this.updatedAt = now;
    }

    void markSynced(String historyId, Instant now) {
        this.historyId = historyId;
        this.lastSyncAt = now;
        this.lastError = null;
        this.updatedAt = now;
    }

    void markError(String message, Instant now) {
        this.lastError = message == null ? "Erreur Gmail" : message.substring(0, Math.min(500, message.length()));
        this.updatedAt = now;
    }

    UUID getId() { return id; }
    UserAccountEntity getOwner() { return owner; }
    String getEmailAddress() { return emailAddress; }
    String getRefreshTokenCiphertext() { return refreshTokenCiphertext; }
    String getHistoryId() { return historyId; }
    boolean isSyncEnabled() { return syncEnabled; }
    Instant getConnectedAt() { return connectedAt; }
    Instant getLastSyncAt() { return lastSyncAt; }
    String getLastError() { return lastError; }
}
