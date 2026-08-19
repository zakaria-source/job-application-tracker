package dev.jobtrackr.gmail;

import dev.jobtrackr.gmail.dto.GmailStatusResponse;
import dev.jobtrackr.gmail.dto.GmailSyncResponse;
import dev.jobtrackr.mailtracking.EmailTrackingService;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisRequest;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisResponse;
import dev.jobtrackr.mailtracking.dto.EmailApplicationMatch;
import dev.jobtrackr.mailtracking.dto.EmailApplyRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
class GmailSyncService {
    private static final Logger log = LoggerFactory.getLogger(GmailSyncService.class);
    private static final String OTHER_SIGNAL = "Autre message";

    private final GmailProperties properties;
    private final GmailApiClient api;
    private final GmailTokenCipher cipher;
    private final GmailConnectionRepository connections;
    private final GmailProcessedMessageRepository processedMessages;
    private final EmailTrackingService emailTracking;

    GmailSyncService(
        GmailProperties properties,
        GmailApiClient api,
        GmailTokenCipher cipher,
        GmailConnectionRepository connections,
        GmailProcessedMessageRepository processedMessages,
        EmailTrackingService emailTracking
    ) {
        this.properties = properties;
        this.api = api;
        this.cipher = cipher;
        this.connections = connections;
        this.processedMessages = processedMessages;
        this.emailTracking = emailTracking;
    }

    GmailStatusResponse status(UUID userId) {
        GmailConnectionEntity connection = connections.findByOwner_Id(userId).orElse(null);
        return new GmailStatusResponse(
            properties.configured(),
            connection != null,
            connection == null ? null : connection.getEmailAddress(),
            connection == null ? null : connection.getLastSyncAt(),
            connection == null ? null : connection.getLastError(),
            properties.getSyncDelayMs()
        );
    }

    GmailSyncResponse syncUser(UUID userId) {
        requireConfigured();
        GmailConnectionEntity connection = connections.findByOwner_Id(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Gmail is not connected"));
        return sync(connection);
    }

    void syncAllConnected() {
        if (!properties.configured()) return;
        for (GmailConnectionEntity connection : connections.findAllBySyncEnabledTrue()) {
            try {
                sync(connection);
            } catch (RuntimeException exception) {
                log.warn("gmail_sync_failed connectionId={} userId={} reason={}",
                    connection.getId(), connection.getOwner().getId(), exception.getClass().getSimpleName());
            }
        }
    }

    void disconnect(UUID userId) {
        connections.findByOwner_Id(userId).ifPresent(connections::delete);
    }

    private GmailSyncResponse sync(GmailConnectionEntity connection) {
        Instant startedAt = Instant.now();
        try {
            String refreshToken = cipher.decrypt(connection.getRefreshTokenCiphertext());
            String accessToken = api.refreshAccessToken(refreshToken);
            boolean fullSync = connection.getHistoryId() == null || connection.getHistoryId().isBlank();
            List<String> messageIds;
            String nextHistoryId;

            if (fullSync) {
                GmailApiClient.GmailProfile baseline = api.profile(accessToken);
                nextHistoryId = baseline.historyId();
                messageIds = api.recentMessageIds(accessToken, properties.getInitialLookbackDays());
            } else {
                try {
                    GmailApiClient.HistoryChanges changes = api.addedMessageIds(accessToken, connection.getHistoryId());
                    messageIds = changes.messageIds();
                    nextHistoryId = changes.historyId();
                } catch (GmailApiClient.HistoryExpiredException expired) {
                    fullSync = true;
                    GmailApiClient.GmailProfile baseline = api.profile(accessToken);
                    nextHistoryId = baseline.historyId();
                    messageIds = api.recentMessageIds(accessToken, properties.getInitialLookbackDays());
                }
            }

            int scanned = 0;
            int matched = 0;
            int applied = 0;
            int ignored = 0;
            UUID userId = connection.getOwner().getId();

            for (String messageId : messageIds) {
                if (processedMessages.existsByConnection_IdAndMessageId(connection.getId(), messageId)) continue;
                GmailApiClient.GmailMessage message = api.message(accessToken, messageId);
                MessageOutcome outcome = processMessage(connection, userId, message);
                scanned++;
                matched += outcome.matched() ? 1 : 0;
                applied += outcome.applied() ? 1 : 0;
                ignored += outcome.ignored() ? 1 : 0;
            }

            Instant syncedAt = Instant.now();
            connection.markSynced(nextHistoryId, syncedAt);
            connections.save(connection);
            log.info("gmail_sync userId={} connectionId={} fullSync={} scanned={} matched={} applied={} ignored={}",
                userId, connection.getId(), fullSync, scanned, matched, applied, ignored);
            return new GmailSyncResponse(scanned, matched, applied, ignored, fullSync, syncedAt);
        } catch (RuntimeException exception) {
            connection.markError(safeMessage(exception), Instant.now());
            connections.save(connection);
            throw exception;
        }
    }

    private MessageOutcome processMessage(
        GmailConnectionEntity connection,
        UUID userId,
        GmailApiClient.GmailMessage message
    ) {
        String subject = valueOr(message.subject(), "(Sans objet)");
        String sender = message.from() == null ? "" : message.from();
        String body = valueOr(message.body(), "(Contenu non disponible)");
        if (body.length() > 20_000) body = body.substring(0, 20_000);

        EmailAnalysisResponse analysis = emailTracking.analyze(
            userId,
            new EmailAnalysisRequest(subject.substring(0, Math.min(300, subject.length())), sender, body)
        );

        EmailApplicationMatch top = analysis.matches().isEmpty() ? null : analysis.matches().get(0);
        Integer topScore = top == null ? null : top.score();
        UUID matchedApplicationId = top == null ? null : top.applicationId();
        boolean matched = top != null && !OTHER_SIGNAL.equals(analysis.signalType());
        boolean autoApply = matched && shouldAutoApply(analysis);

        if (autoApply) {
            emailTracking.apply(userId, new EmailApplyRequest(
                top.applicationId(),
                analysis.suggestedStage(),
                analysis.signalType(),
                subject.substring(0, Math.min(300, subject.length()))
            ));
        }

        processedMessages.save(new GmailProcessedMessageEntity(
            UUID.randomUUID(),
            connection,
            message.id(),
            message.threadId(),
            message.date(),
            Instant.now(),
            matchedApplicationId,
            analysis.signalType(),
            topScore,
            autoApply
        ));

        return new MessageOutcome(matched, autoApply, !matched);
    }

    private boolean shouldAutoApply(EmailAnalysisResponse analysis) {
        if (analysis.signalConfidence() < properties.getAutoApplyMinConfidence()) return false;
        if (analysis.matches().isEmpty()) return false;
        int top = analysis.matches().get(0).score();
        if (top < properties.getAutoApplyMinMatch()) return false;
        if (analysis.matches().size() == 1) return true;
        int second = analysis.matches().get(1).score();
        return top - second >= 15;
    }

    private void requireConfigured() {
        if (!properties.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Gmail integration is not configured");
        }
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
    }

    private record MessageOutcome(boolean matched, boolean applied, boolean ignored) {}
}
