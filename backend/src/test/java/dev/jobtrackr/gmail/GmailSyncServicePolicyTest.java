package dev.jobtrackr.gmail;

import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisResponse;
import dev.jobtrackr.mailtracking.dto.EmailApplicationMatch;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GmailSyncServicePolicyTest {

    @Test
    void demonstratesExpectedActivityThresholds() {
        EmailApplicationMatch confident = new EmailApplicationMatch(
            UUID.randomUUID(), "Mirakl", "Software Engineer Java", RecruitmentStage.CANDIDATURE, 45, List.of("Entreprise trouvée dans l'objet")
        );
        EmailApplicationMatch weak = new EmailApplicationMatch(
            UUID.randomUUID(), "Other", "Software Engineer", RecruitmentStage.CANDIDATURE, 15, List.of("Intitulé du poste partiellement reconnu")
        );

        assertTrue(confident.score() >= 30);
        assertFalse(weak.score() >= 30);
    }

    @Test
    void acknowledgementCanBeRecordedWithoutForcingStageChange() {
        EmailApplicationMatch match = new EmailApplicationMatch(
            UUID.randomUUID(), "Doctolib", "Software Engineer II", RecruitmentStage.CANDIDATURE, 40, List.of("Entreprise trouvée dans le nom de l'expéditeur")
        );
        EmailAnalysisResponse analysis = new EmailAnalysisResponse(
            "Candidature reçue", null, 88, "Candidature reçue", List.of("thank you for applying"), List.of(match)
        );

        assertTrue(analysis.matches().get(0).score() >= 30);
        assertTrue(analysis.suggestedStage() == null);
    }

    @Test
    void ordersMessagesFromOldestToNewestBeforeApplyingSignals() {
        var newest = message("newest", "2026-08-18T12:00:00Z");
        var oldest = message("oldest", "2026-08-13T08:00:00Z");
        var middle = message("middle", "2026-08-16T10:00:00Z");

        var ordered = GmailSyncService.chronological(List.of(newest, oldest, middle));

        assertEquals(List.of("oldest", "middle", "newest"), ordered.stream().map(GmailApiClient.GmailMessage::id).toList());
    }

    private static GmailApiClient.GmailMessage message(String id, String date) {
        return new GmailApiClient.GmailMessage(
            id,
            "thread",
            "history",
            "subject",
            "sender@example.com",
            "body",
            Instant.parse(date)
        );
    }
}
