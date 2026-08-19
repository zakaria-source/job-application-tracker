package dev.jobtrackr.mailtracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.JobApplicationRepository;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.tracking.ApplicationTrackingService;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisRequest;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisResponse;
import dev.jobtrackr.mailtracking.dto.EmailApplicationMatch;
import dev.jobtrackr.mailtracking.dto.EmailApplyRequest;
import dev.jobtrackr.mailtracking.dto.EmailApplyResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class EmailTrackingService {
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE
    );
    private static final Set<String> GENERIC_EMAIL_DOMAINS = Set.of(
        "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com"
    );
    private static final Set<String> POSITION_STOP_WORDS = Set.of(
        "software", "engineer", "ingenieur", "developer", "developpeur", "backend", "frontend", "fullstack",
        "senior", "junior", "stage", "intern", "alternance", "java", "cloud", "remote", "paris"
    );

    private final JobApplicationRepository applications;
    private final EmailSignalClassifier classifier;
    private final ApplicationTrackingService tracking;

    public EmailTrackingService(
        JobApplicationRepository applications,
        EmailSignalClassifier classifier,
        ApplicationTrackingService tracking
    ) {
        this.applications = applications;
        this.classifier = classifier;
        this.tracking = tracking;
    }

    @Transactional(readOnly = true)
    public EmailAnalysisResponse analyze(UUID userId, EmailAnalysisRequest request) {
        EmailSignalClassifier.Classification classification = classifier.classify(request.subject(), request.body());
        String normalizedSubject = EmailSignalClassifier.normalize(request.subject());
        String normalizedBody = EmailSignalClassifier.normalize(request.body());
        String senderEmail = extractEmail(request.sender());

        List<EmailApplicationMatch> matches = applications.findAllByOwner_Id(userId).stream()
            .map(application -> score(application, normalizedSubject, normalizedBody, senderEmail))
            .filter(match -> match.score() >= 15)
            .sorted(Comparator.comparingInt(EmailApplicationMatch::score).reversed())
            .limit(3)
            .toList();

        RecruitmentStage suggestedStage = safeSuggestedStage(classification.suggestedStage(), matches);

        return new EmailAnalysisResponse(
            classification.type().label(),
            suggestedStage,
            classification.confidence(),
            classification.summary(),
            classification.evidence(),
            matches
        );
    }

    @Transactional
    public EmailApplyResponse apply(UUID userId, EmailApplyRequest request) {
        JobApplicationEntity application = applications.findByIdAndOwner_Id(request.applicationId(), userId)
            .orElseThrow(ResourceNotFoundException::new);
        RecruitmentStage previousStage = application.getStage();
        Instant now = Instant.now();

        if (request.stage() != null && request.stage() != previousStage) {
            application.moveTo(request.stage(), now);
            tracking.recordStageChanged(application, previousStage, now);
        } else {
            application.touch(now);
        }

        tracking.recordEmailSignal(application, request.signalType(), request.subject(), now);
        applications.flush();

        return new EmailApplyResponse(
            application.getId(),
            application.getStage(),
            request.stage() != null && request.stage() != previousStage
                ? "Mail enregistré et étape mise à jour"
                : "Mail enregistré dans l'activité de la candidature"
        );
    }

    private static RecruitmentStage safeSuggestedStage(
        RecruitmentStage suggested,
        List<EmailApplicationMatch> matches
    ) {
        if (suggested == null || matches.isEmpty()) return null;
        RecruitmentStage current = matches.get(0).currentStage();
        if (suggested == RecruitmentStage.CLOTURE || suggested == RecruitmentStage.OFFRE) return suggested;
        return suggested.ordinal() > current.ordinal() ? suggested : null;
    }

    private static EmailApplicationMatch score(
        JobApplicationEntity application,
        String subject,
        String body,
        String senderEmail
    ) {
        int score = 0;
        List<String> reasons = new ArrayList<>();
        String company = EmailSignalClassifier.normalize(application.getCompany());
        String recruiterEmail = normalizeEmail(application.getRecruiterEmail());

        if (!senderEmail.isBlank() && !recruiterEmail.isBlank() && senderEmail.equals(recruiterEmail)) {
            score += 70;
            reasons.add("Expéditeur identique à l'adresse du recruteur");
        }

        if (company.length() >= 3 && subject.contains(company)) {
            score += 45;
            reasons.add("Entreprise trouvée dans l'objet");
        } else if (company.length() >= 3 && body.contains(company)) {
            score += 30;
            reasons.add("Entreprise trouvée dans le corps du mail");
        }

        String domain = emailDomain(senderEmail);
        if (!domain.isBlank() && !GENERIC_EMAIL_DOMAINS.contains(domain)) {
            for (String token : companyTokens(company)) {
                if (token.length() >= 4 && domain.contains(token)) {
                    score += 25;
                    reasons.add("Domaine de l'expéditeur proche du nom de l'entreprise");
                    break;
                }
            }
        }

        int positionScore = 0;
        for (String token : positionTokens(application.getPosition())) {
            if (subject.contains(token)) {
                positionScore += 8;
            } else if (body.contains(token)) {
                positionScore += 4;
            }
            if (positionScore >= 20) break;
        }
        if (positionScore > 0) {
            score += Math.min(20, positionScore);
            reasons.add("Intitulé du poste partiellement reconnu");
        }

        return new EmailApplicationMatch(
            application.getId(),
            application.getCompany(),
            application.getPosition(),
            application.getStage(),
            Math.min(100, score),
            List.copyOf(reasons)
        );
    }

    private static Set<String> companyTokens(String company) {
        Set<String> tokens = new HashSet<>();
        for (String token : company.split("[^a-z0-9]+")) {
            if (!token.isBlank()) tokens.add(token);
        }
        return tokens;
    }

    private static Set<String> positionTokens(String position) {
        Set<String> tokens = new HashSet<>();
        String normalized = EmailSignalClassifier.normalize(position);
        for (String token : normalized.split("[^a-z0-9]+")) {
            if (token.length() >= 4 && !POSITION_STOP_WORDS.contains(token)) tokens.add(token);
        }
        return tokens;
    }

    private static String extractEmail(String sender) {
        if (sender == null || sender.isBlank()) return "";
        Matcher matcher = EMAIL_PATTERN.matcher(sender);
        return matcher.find() ? matcher.group().toLowerCase(Locale.ROOT) : "";
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String emailDomain(String email) {
        int separator = email.indexOf('@');
        return separator >= 0 && separator + 1 < email.length() ? email.substring(separator + 1) : "";
    }
}
