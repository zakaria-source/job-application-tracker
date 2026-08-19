package dev.jobtrackr.gmail;

import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class GmailApplicationDiscoveryServiceTest {
    private final GmailApplicationDiscoveryService service = new GmailApplicationDiscoveryService(null);

    @Test
    void extractsCompanyAndPositionFromRecruiterMail() {
        var message = new GmailApiClient.GmailMessage(
            "m1",
            "t1",
            "h1",
            "Votre candidature au poste de Software Engineer Java",
            "Mirakl Careers <jobs@mirakl.com>",
            "Merci pour votre candidature. Nous avons bien reçu votre dossier pour ce poste en CDI.",
            Instant.parse("2026-08-13T08:00:00Z")
        );
        var analysis = new EmailAnalysisResponse(
            "Accusé de réception",
            null,
            88,
            "",
            List.of(),
            List.of()
        );

        var candidate = service.extractCandidate(message, analysis);

        assertNotNull(candidate);
        assertEquals("Mirakl", candidate.company());
        assertEquals("Software Engineer Java", candidate.position());
        assertEquals(LocalDate.of(2026, 8, 13), candidate.applicationDate());
        assertEquals(ContractType.CDI, candidate.contractType());
        assertEquals(RecruitmentStage.CANDIDATURE, candidate.stage());
        assertEquals("jobs@mirakl.com", candidate.recruiterEmail());
    }

    @Test
    void extractsCompanyFromMailEvenWhenSenderIsGenericAts() {
        var message = new GmailApiClient.GmailMessage(
            "m2",
            "t2",
            "h2",
            "Your application for Backend Engineer at Acme",
            "Greenhouse <no-reply@greenhouse.io>",
            "Thank you for applying. We received your application.",
            Instant.parse("2026-08-14T12:00:00Z")
        );
        var analysis = new EmailAnalysisResponse(
            "Accusé de réception",
            null,
            88,
            "",
            List.of(),
            List.of()
        );

        var candidate = service.extractCandidate(message, analysis);

        assertNotNull(candidate);
        assertEquals("Acme", candidate.company());
        assertEquals("Backend Engineer", candidate.position());
    }

    @Test
    void startsDiscoveredApplicationAtInterviewStageWhenSignalIsStrong() {
        var message = new GmailApiClient.GmailMessage(
            "m3",
            "t3",
            "h3",
            "Technical interview - Platform Engineer",
            "Datadog Recruiting <recruiting@datadoghq.com>",
            "We would like to schedule a technical interview for the Platform Engineer position.",
            Instant.parse("2026-08-18T15:00:00Z")
        );
        var analysis = new EmailAnalysisResponse(
            "Invitation entretien",
            RecruitmentStage.ENTRETIEN_TECHNIQUE,
            92,
            "",
            List.of(),
            List.of()
        );

        var candidate = service.extractCandidate(message, analysis);

        assertNotNull(candidate);
        assertEquals("Datadog", candidate.company());
        assertEquals(RecruitmentStage.ENTRETIEN_TECHNIQUE, candidate.stage());
    }

    @Test
    void doesNotCreateFromGenericFollowUpWithoutApplicationContext() {
        var message = new GmailApiClient.GmailMessage(
            "m4",
            "t4",
            "h4",
            "Following up",
            "Example Sales <hello@example.com>",
            "Following up on our product demo from last week.",
            Instant.parse("2026-08-18T15:00:00Z")
        );
        var analysis = new EmailAnalysisResponse(
            "Relance / reprise de contact",
            null,
            76,
            "",
            List.of(),
            List.of()
        );

        assertNull(service.extractCandidate(message, analysis));
    }
}
