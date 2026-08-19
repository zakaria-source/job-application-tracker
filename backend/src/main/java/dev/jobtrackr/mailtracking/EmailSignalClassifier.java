package dev.jobtrackr.mailtracking;

import dev.jobtrackr.application.domain.RecruitmentStage;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
class EmailSignalClassifier {
    private static final List<String> REJECTION = List.of(
        "ne donnerons pas suite", "ne pourrons pas donner suite", "ne donnerons malheureusement pas suite",
        "candidature n'a pas ete retenue", "candidature n est pas retenue", "candidature n'a pas ete selectionnee",
        "candidature n a pas ete selectionnee", "profil ne correspond pas", "nous ne poursuivrons pas",
        "nous avons decide de poursuivre avec d'autres", "nous avons choisi de poursuivre avec d'autres",
        "we regret", "unfortunately", "not move forward", "not to move forward", "not moving forward",
        "won't be moving forward", "will not be progressing", "not proceeding with your application",
        "decided not to proceed", "decided not to progress", "not selected", "not successful",
        "move forward with other candidates", "other candidates"
    );
    private static final List<String> OFFER = List.of(
        "proposition d'embauche", "proposition d embauche", "offre d'emploi", "offre d emploi",
        "nous avons le plaisir de vous faire une offre", "nous souhaitons vous faire une offre",
        "pleased to offer", "we would like to offer", "job offer", "offer letter",
        "congratulations", "felicitations"
    );
    private static final List<String> FINAL_INTERVIEW = List.of(
        "entretien final", "final interview", "final round", "derniere etape", "derniere étape"
    );
    private static final List<String> MANAGER_INTERVIEW = List.of(
        "hiring manager", "engineering manager", "manager interview", "entretien manager",
        "entretien avec le manager", "echange avec le manager", "échange avec le manager"
    );
    private static final List<String> TECHNICAL_INTERVIEW = List.of(
        "entretien technique", "technical interview", "technical round", "coding interview", "coding challenge",
        "live coding", "case study", "etude de cas", "exercice technique", "test technique", "technical assessment",
        "take-home test", "take home test"
    );
    private static final List<String> INTERVIEW = List.of(
        "entretien", "interview", "screening", "phone screen", "recruiter screen", "echange telephonique",
        "échange téléphonique", "echange de 30 minutes", "échange de 30 minutes", "echange de 45 minutes",
        "échange de 45 minutes", "echange avec", "échange avec", "faire un point", "point telephonique",
        "point téléphonique", "rendez-vous", "vos disponibilites", "vos disponibilités", "seriez-vous disponible",
        "etes-vous disponible", "êtes-vous disponible", "your availability", "are you available", "schedule a call",
        "schedule time", "schedule a time", "book a call", "book a time", "choose a time", "pick a time",
        "meet with", "speak with you", "chat with you", "would like to speak", "would like to chat",
        "would like to meet", "invite you to", "interview invitation", "next interview", "calendly"
    );
    private static final List<String> ACKNOWLEDGEMENT = List.of(
        "candidature bien recue", "candidature a bien ete recue", "candidature a ete recue",
        "candidature a bien ete enregistree", "candidature a ete enregistree", "merci pour votre candidature",
        "merci de votre candidature", "nous avons bien recu votre candidature", "nous accusons reception de votre candidature",
        "application received", "received your application", "we have received your application",
        "thank you for applying", "thanks for applying", "thank you for your application",
        "thank you for your interest", "thanks for your interest", "application has been received",
        "application was received", "application successfully submitted"
    );
    private static final List<String> FOLLOW_UP = List.of(
        "suite a notre echange", "suite à notre échange", "je reviens vers vous", "nous revenons vers vous",
        "comme convenu", "following up", "follow up", "getting back to you", "reconnect", "reprendre contact",
        "next step", "next steps", "prochaine etape", "prochaine étape", "processus de recrutement"
    );

    Classification classify(String subject, String body) {
        String text = normalize((subject == null ? "" : subject) + "\n" + (body == null ? "" : body));

        Match rejection = match(text, REJECTION);
        if (rejection.found()) {
            return result(EmailSignalType.REJECTION, RecruitmentStage.CLOTURE, 96,
                "Le message ressemble à un refus de candidature.", rejection.phrases());
        }

        Match offer = match(text, OFFER);
        if (offer.found()) {
            return result(EmailSignalType.OFFER, RecruitmentStage.OFFRE, 95,
                "Le message ressemble à une offre ou une proposition d'embauche.", offer.phrases());
        }

        Match finalInterview = match(text, FINAL_INTERVIEW);
        if (finalInterview.found()) {
            return result(EmailSignalType.INTERVIEW, RecruitmentStage.ENTRETIEN_FINAL, 92,
                "Une étape d'entretien final a été détectée.", finalInterview.phrases());
        }

        Match managerInterview = match(text, MANAGER_INTERVIEW);
        if (managerInterview.found()) {
            return result(EmailSignalType.INTERVIEW, RecruitmentStage.HIRING_MANAGER, 90,
                "Un entretien avec un manager a été détecté.", managerInterview.phrases());
        }

        Match technicalInterview = match(text, TECHNICAL_INTERVIEW);
        if (technicalInterview.found()) {
            return result(EmailSignalType.INTERVIEW, RecruitmentStage.ENTRETIEN_TECHNIQUE, 92,
                "Une étape d'entretien technique a été détectée.", technicalInterview.phrases());
        }

        Match interview = match(text, INTERVIEW);
        if (interview.found()) {
            return result(EmailSignalType.INTERVIEW, RecruitmentStage.SCREENING_RH, 86,
                "Une invitation ou une demande de disponibilité pour un entretien a été détectée.", interview.phrases());
        }

        Match acknowledgement = match(text, ACKNOWLEDGEMENT);
        if (acknowledgement.found()) {
            return result(EmailSignalType.ACKNOWLEDGEMENT, null, 88,
                "Le message confirme la réception de la candidature sans nouvelle étape explicite.", acknowledgement.phrases());
        }

        Match followUp = match(text, FOLLOW_UP);
        if (followUp.found()) {
            return result(EmailSignalType.FOLLOW_UP, null, 78,
                "Le message ressemble à une reprise de contact ou une relance.", followUp.phrases());
        }

        return result(EmailSignalType.OTHER, null, 35,
            "Aucun signal de recrutement suffisamment précis n'a été détecté.", List.of());
    }

    private static Classification result(
        EmailSignalType type,
        RecruitmentStage stage,
        int confidence,
        String summary,
        List<String> evidence
    ) {
        return new Classification(type, stage, confidence, summary, List.copyOf(evidence));
    }

    private static Match match(String text, List<String> phrases) {
        List<String> found = new ArrayList<>();
        for (String phrase : phrases) {
            String normalizedPhrase = normalize(phrase);
            if (text.contains(normalizedPhrase)) {
                found.add(phrase);
                if (found.size() == 3) break;
            }
        }
        return new Match(found);
    }

    static String normalize(String value) {
        String decomposed = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "")
            .replace("’", "'")
            .toLowerCase(Locale.ROOT)
            .replaceAll("\\s+", " ")
            .trim();
    }

    record Classification(
        EmailSignalType type,
        RecruitmentStage suggestedStage,
        int confidence,
        String summary,
        List<String> evidence
    ) {}

    private record Match(List<String> phrases) {
        boolean found() { return !phrases.isEmpty(); }
    }
}
