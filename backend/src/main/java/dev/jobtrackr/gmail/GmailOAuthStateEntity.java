package dev.jobtrackr.gmail;

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
@Table(name = "gmail_oauth_state")
class GmailOAuthStateEntity {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccountEntity owner;

    @Column(name = "state_hash", nullable = false, unique = true, length = 64)
    private String stateHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected GmailOAuthStateEntity() {}

    GmailOAuthStateEntity(UUID id, UserAccountEntity owner, String stateHash, Instant expiresAt, Instant now) {
        this.id = id;
        this.owner = owner;
        this.stateHash = stateHash;
        this.expiresAt = expiresAt;
        this.createdAt = now;
    }

    UserAccountEntity getOwner() { return owner; }
    Instant getExpiresAt() { return expiresAt; }
}
