package dev.jobtrackr.gmail;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

interface GmailOAuthStateRepository extends JpaRepository<GmailOAuthStateEntity, UUID> {
    Optional<GmailOAuthStateEntity> findByStateHash(String stateHash);
    long deleteByExpiresAtBefore(Instant now);
}
