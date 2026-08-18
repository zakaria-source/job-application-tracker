package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.domain.ApplicationStatus;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.tracking.dto.ApplicationHealthResponse;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
class ApplicationHealthService {

    ApplicationHealthResponse calculate(
        JobApplicationEntity application,
        List<FollowUpEntity> followUps,
        LocalDate today,
        Instant now
    ) {
        List<String> strengths = new ArrayList<>();
        List<String> risks = new ArrayList<>();
        int score = 20;

        long inactiveDays = Math.max(0, Duration.between(application.getLastUpdated(), now).toDays());
        if (inactiveDays <= 7) {
            score += 20;
            strengths.add("Activité récente");
        } else if (inactiveDays <= 14) {
            score += 10;
        } else {
            risks.add("Aucune activité depuis " + inactiveDays + " jours");
        }

        if (application.getRecruiterName() != null || application.getRecruiterEmail() != null) {
            score += 15;
            strengths.add("Contact recruteur identifié");
        } else {
            risks.add("Aucun contact recruteur");
        }

        if (application.getResponseDate() != null) {
            score += 15;
            strengths.add("Réponse reçue");
        }
        if (!application.getInterviews().isEmpty()) {
            score += 15;
            strengths.add("Entretien enregistré");
        }
        if (application.getStage() != RecruitmentStage.CANDIDATURE
            && application.getStage() != RecruitmentStage.CLOTURE) {
            score += 10;
            strengths.add("Pipeline en progression");
        }

        Optional<FollowUpEntity> open = followUps.stream()
            .filter(item -> {
                FollowUpStatus effective = item.effectiveStatus(today);
                return effective == FollowUpStatus.PLANNED
                    || effective == FollowUpStatus.DUE
                    || effective == FollowUpStatus.OVERDUE;
            })
            .findFirst();

        if (open.isPresent()) {
            FollowUpStatus effectiveStatus = open.get().effectiveStatus(today);
            score += 15;
            strengths.add("Prochaine relance planifiée");
            if (effectiveStatus == FollowUpStatus.OVERDUE) {
                score -= 20;
                risks.add("Relance en retard");
            }
        } else if (application.getStatus() == ApplicationStatus.ENVOYE) {
            risks.add("Aucune prochaine action planifiée");
        }

        score = Math.max(0, Math.min(100, score));
        String level = score >= 75 ? "HEALTHY" : score >= 50 ? "WATCH" : "AT_RISK";
        return new ApplicationHealthResponse(score, level, strengths, risks);
    }
}
