package dev.jobtrackr.gmail;

import dev.jobtrackr.application.dto.ApplicationResponse;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
class GmailSyncService {
    private static final Logger log = LoggerFactory.getLogger(GmailSyncService.class);
    private static final String OTHER_SIGNAL = "Autre message";
    private static final int MIN_ACTIVITY_MATCH_SCORE = 30;
    private static final int MIN_ACTIVITY_MATCH_GAP = 5;

    private final GmailProperties properties;
    private final GmailApiClient api;
    private final GmailTokenCipher cipher;
    private final GmailConnectionRepository connections;
    private final GmailProcessedMessageRepository processedMessages;
    private final EmailTrackingService emailTracking;
    private final GmailApplicationDiscoveryService discovery;

    GmailSyncService(
        GmailProperties properties,
        GmailApiClient api,
        GmailTokenCipher cipher,
        GmailConnectionRepository connections,
        GmailProcessedMessageRepository processedMessages,
        EmailTrackingService emailTracking,
        GmailApplicationDiscoveryService discovery
    ) {
        this.properties = properties;
        this.api = api;
        this.cipher = cipher;
        this.connections = connections;
        this.processedMessages = processedMessages;
        this.emailTracking = emailTracking;
        this.discovery = discovery;
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
        return sync(connection, true);
    }

    void syncAllConnected() {
        if (!properties.configured()) return;
        for (GmailConnectionEntity connection : connections.findAllBySyncEnabledTrue()) {
            try {
                sync(connection, false);
            } catch (RuntimeException exception) {
                log.warn("gmail_sync_failed connectionId={} userId={} reason={}",
                    connection.getId(), connection.getOwner().getId(), exception.getClass().getSimpleName());
            }
        }
    }

    void disconnect(UUID userId) {
        connections.findByOwner_Id(userId).ifPresent(connections::delete);
    }

    private GmailSyncResponse sync(GmailConnectionEntity connection, boolean rescanRecent) {
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
                    nextHistoryId = changes.historyId();
                    if (rescanRecent) {
                        Set<String> ids = new LinkedHashSet<>(changes.messageIds());
                        ids.addAll(api.recentMessageIds(accessToken, properties.getInitialLookbackDays()));
                        messageIds = List.copyOf(ids);
                    } else {
                        messageIds = changes.messageIds();
                    }
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
            int created = 0;
            UUID userId = connection.getOwner().getId();

            for (String messageId : messageIds) {
                GmailProcessedMessageEntity previous = processedMessages
                    .findByConnection_IdAndMessageId(connection.getId(), messageId)
                    .orElse(null);
                if (previous != null) {
                    if (!rescanRecent || previous.isAutoApplied()) continue;
                    processedMessages.delete(previous);
                    processedMessages.flush();
                }

                GmailApiClient.GmailMessage message = api.message(accessToken, messageId);
                MessageOutcome outcome = processMessage(connection, userId, message);
                scanned++;
                matched += outcome.matched() ? 1 : 0;
                applied += outcome.applied() ? 1 : 0;
                ignored += outcome.ignored() ? 1 : 0;
                created += outcome.created() ? 1 : 0;
            }

            Instant syncedAt = Instant.now();
            connection.markSynced(nextHistoryId, syncedAt);
            connections.save(connection);
            log.info("gmail_sync userId={} connectionId={} fullSync={} rescanRecent={} scanned={} matched={} applied={} created={} ignored={}",
                userId, connection.getId(), fullSync, rescanRecent, scanned, matched, applied, created, ignored);
            return new GmailSyncResponse(scanned, matched, applied, ignored, created, fullSync, syncedAt);
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

        if (analysis.matches().isEmpty() && !OTHER_SIGNAL.equals(analysis.signalType())) {
            Optional<ApplicationResponse> created = discovery.createIfMissing(userId, message, analysis);
            if (created.isPresent()) {
                ApplicationResponse application = created.get();
                emailTracking.apply(userId, new EmailApplyRequest(
                    application.id(),
                    null,
                    analysis.signalType(),
                    subject.substring(0, Math.min(300, subject.length()))
                ));
                processedMessages.save(new GmailProcessedMessageEntity(
                    UUID.randomUUID(),
                    connection,
                    message.id(),
                    message.threadId(),
                    message.date(),
                    Instant.now(),
                    application.id(),
                    analysis.signalType(),
                    100,
                    true
                ));
                log.info("gmail_application_discovered userId={} applicationId={} company={} position={} signal={}",
                    userId, application.id(), application.company(), application.position(), analysis.signalType());
                return new MessageOutcome(true, true, false, true);
            }
        }

        EmailApplicationMatch top = analysis.matches().isEmpty() ? null : analysis.matches().get(0);
        Integer topScore = top == null ? null : top.score();
        UUID matchedApplicationId = top == null ? null : top.applicationId();
        boolean matched = top != null && !OTHER_SIGNAL.equals(analysis.signalType());
        boolean recordActivity = matched && shouldRecordActivity(analysis);
        boolean moveStage = recordActivity && shouldAutoApply(analysis);

        if (recordActivity) {
            emailTracking.apply(userId, new EmailApplyRequest(
                top.applicationId(),
                moveStage ? analysis.suggestedStage() : null,
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
            recordActivity
        ));

        return new MessageOutcome(matched, recordActivity, !recordActivity, false);
    }

    private boolean shouldRecordActivity(EmailAnalysisResponse analysis) {
        if (analysis.matches().isEmpty()) return false;
        int top = analysis.matches().get(0).score();
        if (top < MIN_ACTIVITY_MATCH_SCORE) return false;
        if (analysis.matches().size() == 1) return true;
        int second = analysis.matches().get(1).score();
        return top >= properties.getAutoApplyMinMatch() || top - second >= MIN_ACTIVITY_MATCH_GAP;
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

    private record MessageOutcome(boolean matched, boolean applied, boolean ignored, boolean created) {}
}
