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

    @Test
    void detectsFrenchRecruiterAvailabilityRequest() {
        var result = classifier.classify(
            "Votre candidature - Software Engineer",
            "Votre profil m'intéresse. Seriez-vous disponible pour un échange de 30 minutes cette semaine ?"
        );

        assertEquals(EmailSignalType.INTERVIEW, result.type());
        assertEquals(RecruitmentStage.SCREENING_RH, result.suggestedStage());
        assertTrue(result.confidence() >= 80);
    }

    @Test
    void detectsAtsAcknowledgementUsingInterestWording() {
        var result = classifier.classify(
            "Application received",
            "Thank you for your interest in the Software Engineer position. Your application has been received."
        );

        assertEquals(EmailSignalType.ACKNOWLEDGEMENT, result.type());
        assertNull(result.suggestedStage());
    }

    @Test
    void detectsCommonEnglishRejectionWording() {
        var result = classifier.classify(
            "Update on your application",
            "After careful consideration, we have decided not to move forward with your application."
        );

        assertEquals(EmailSignalType.REJECTION, result.type());
        assertEquals(RecruitmentStage.CLOTURE, result.suggestedStage());
        assertTrue(result.confidence() >= 90);
    }
}
