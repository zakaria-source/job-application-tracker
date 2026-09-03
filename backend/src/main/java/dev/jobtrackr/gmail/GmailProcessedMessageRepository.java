package dev.jobtrackr.gmail;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface GmailProcessedMessageRepository extends JpaRepository<GmailProcessedMessageEntity, UUID> {
    boolean existsByConnection_IdAndMessageId(UUID connectionId, String messageId);
    Optional<GmailProcessedMessageEntity> findByConnection_IdAndMessageId(UUID connectionId, String messageId);
    List<GmailProcessedMessageEntity> findAllByConnection_IdAndMessageIdIn(UUID connectionId, List<String> messageIds);
    Optional<GmailProcessedMessageEntity> findFirstByConnection_IdAndThreadIdAndMatchedApplicationIdIsNotNullOrderByMessageDateDescProcessedAtDesc(
        UUID connectionId,
        String threadId
    );
}
