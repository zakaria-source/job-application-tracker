package dev.jobtrackr.mailtracking;

import dev.jobtrackr.application.domain.RecruitmentStage;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailSignalClassifierTest {
    private final EmailSignalClassifier classifier = new EmailSignalClassifier();

    @Test
    void detectsFrenchRejection() {
        var result = classifier.classify(
            "Votre candidature",
            "Après étude de votre profil, nous ne donnerons malheureusement pas suite à votre candidature."
        );

        assertEquals(EmailSignalType.REJECTION, result.type());
        assertEquals(RecruitmentStage.CLOTURE, result.suggestedStage());
        assertTrue(result.confidence() >= 90);
    }

    @Test
    void detectsTechnicalInterview() {
        var result = classifier.classify(
            "Technical interview - next step",
            "We would like to schedule a technical interview and a live coding session with the team."
        );

        assertEquals(EmailSignalType.INTERVIEW, result.type());
        assertEquals(RecruitmentStage.ENTRETIEN_TECHNIQUE, result.suggestedStage());
        assertTrue(result.confidence() >= 90);
    }

    @Test
    void acknowledgementDoesNotForceStageChange() {
        var result = classifier.classify(
            "Candidature bien reçue",
            "Merci pour votre candidature. Nous avons bien reçu votre dossier et reviendrons vers vous."
        );

        assertEquals(EmailSignalType.ACKNOWLEDGEMENT, result.type());
        assertNull(result.suggestedStage());
    }

    @Test
    void detectsOfferBeforeGenericInterviewLanguage() {
        var result = classifier.classify(
            "Job offer",
            "Congratulations. We are pleased to offer you the position and would like to schedule a call to discuss it."
        );

        assertEquals(EmailSignalType.OFFER, result.type());
        assertEquals(RecruitmentStage.OFFRE, result.suggestedStage());
    }
}
