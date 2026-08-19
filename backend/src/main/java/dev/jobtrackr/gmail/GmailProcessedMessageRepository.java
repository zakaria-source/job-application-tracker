package dev.jobtrackr.gmail;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

interface GmailProcessedMessageRepository extends JpaRepository<GmailProcessedMessageEntity, UUID> {
    boolean existsByConnection_IdAndMessageId(UUID connectionId, String messageId);
}
