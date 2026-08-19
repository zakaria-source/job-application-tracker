package dev.jobtrackr.gmail;

import dev.jobtrackr.application.ApplicationService;
import dev.jobtrackr.application.domain.ApplicationPriority;
import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.domain.SalaryPeriod;
import dev.jobtrackr.application.dto.ApplicationRequest;
import dev.jobtrackr.application.dto.ApplicationResponse;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
class GmailApplicationDiscoveryService {
    private static final String OTHER_SIGNAL = "Autre message";
    private static final String FOLLOW_UP_SIGNAL = "Relance / reprise de contact";
    private static final int MIN_DISCOVERY_CONFIDENCE = 70;
    private static final String UNKNOWN_POSITION = "Poste à identifier";

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE
    );
    private static final Pattern COMPANY_CONTEXT_PATTERN = Pattern.compile(
        "(?iu)(?:application|candidature|interview|entretien)[^\\n]{0,120}\\b(?:at|chez|with|aupres de|auprès de)\\s+([\\p{L}0-9][\\p{L}0-9&.'’+\\- ]{1,70})"
    );
    private static final Pattern POSITION_PATTERN = Pattern.compile(
        "(?iu)(?:application for|applying for|applied for|candidature (?:pour|au poste de)|postul(?:e|é|ée) (?:pour|au poste de)|position|role|rôle|poste)\\s*[:\\-]?\\s*[\"“]?([^\\n|]{3,140})"
    );
    private static final Set<String> GENERIC_DOMAINS = Set.of(
        "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com",
        "greenhouse.io", "greenhouse-mail.io", "lever.co", "ashbyhq.com", "workday.com", "myworkdayjobs.com",
        "smartrecruiters.com", "teamtailor.com", "recruitee.com"
    );
    private static final Set<String> GENERIC_COMPANY_NAMES = Set.of(
        "greenhouse", "workday", "lever", "ashby", "smartrecruiters", "teamtailor", "recruitee", "recruiting",
        "recruitment", "careers", "career", "jobs", "job", "talent", "hiring", "notifications", "notification"
    );

    private final ApplicationService applications;

    GmailApplicationDiscoveryService(ApplicationService applications) {
        this.applications = applications;
    }

    Optional<ApplicationResponse> createIfMissing(
        UUID userId,
        GmailApiClient.GmailMessage message,
        EmailAnalysisResponse analysis
    ) {
        DiscoveryCandidate candidate = extractCandidate(message, analysis);
        if (candidate == null) return Optional.empty();

        ApplicationRequest request = new ApplicationRequest(
            candidate.company(),
            candidate.position(),
            candidate.applicationDate(),
            null,
            candidate.notes(),
            candidate.responseDate(),
            null,
            candidate.contractType(),
            null,
            SalaryPeriod.ANNUEL,
            null,
            candidate.recruiterName(),
            candidate.recruiterEmail(),
            null,
            candidate.stage(),
            ApplicationPriority.MOYENNE,
            List.of()
        );
        return Optional.of(applications.create(userId, request));
    }

    DiscoveryCandidate extractCandidate(
        GmailApiClient.GmailMessage message,
        EmailAnalysisResponse analysis
    ) {
        if (analysis == null || message == null) return null;
        if (OTHER_SIGNAL.equals(analysis.signalType()) || analysis.signalConfidence() < MIN_DISCOVERY_CONFIDENCE) return null;

        String subject = safe(message.subject());
        String body = safe(message.body());
        String sender = safe(message.from());
        if (FOLLOW_UP_SIGNAL.equals(analysis.signalType()) && !looksLikeApplicationContext(subject + "\n" + body)) return null;

        String recruiterEmail = extractEmail(sender);
        String recruiterName = extractDisplayName(sender);
        String company = extractCompany(subject, body, sender, recruiterEmail);
        if (company.isBlank()) return null;

        String position = extractPosition(subject, body, company);
        if (position.isBlank()) position = UNKNOWN_POSITION;

        LocalDate mailDate = message.date() == null
            ? LocalDate.now(ZoneOffset.UTC)
            : message.date().atZone(ZoneOffset.UTC).toLocalDate();
        RecruitmentStage stage = analysis.suggestedStage() != null && analysis.signalConfidence() >= 80
            ? analysis.suggestedStage()
            : RecruitmentStage.CANDIDATURE;
        LocalDate responseDate = stage == RecruitmentStage.OFFRE || stage == RecruitmentStage.CLOTURE ? mailDate : null;
        ContractType contractType = detectContractType(subject + "\n" + body);
        String notes = "Créée automatiquement depuis Gmail. Vérifier les informations extraites."
            + (subject.isBlank() ? "" : " Mail initial : " + truncate(subject, 220));

        return new DiscoveryCandidate(
            company,
            position,
            mailDate,
            responseDate,
            contractType,
            recruiterName.isBlank() ? null : recruiterName,
            recruiterEmail.isBlank() ? null : recruiterEmail,
            stage,
            notes
        );
    }

    private static String extractCompany(String subject, String body, String sender, String recruiterEmail) {
        String displayName = cleanCompanyName(extractDisplayName(sender));
        if (isUsefulCompany(displayName)) return displayName;

        Matcher context = COMPANY_CONTEXT_PATTERN.matcher(subject + "\n" + body);
        if (context.find()) {
            String candidate = cleanCompanyName(context.group(1));
            if (isUsefulCompany(candidate)) return candidate;
        }

        String domainCompany = companyFromDomain(recruiterEmail);
        return isUsefulCompany(domainCompany) ? domainCompany : "";
    }

    private static String extractPosition(String subject, String body, String company) {
        Matcher matcher = POSITION_PATTERN.matcher(subject + "\n" + body);
        if (matcher.find()) {
            String candidate = cleanPosition(matcher.group(1), company);
            if (candidate.length() >= 3) return truncate(candidate, 220);
        }

        String cleanedSubject = subject
            .replaceAll("(?iu)^(re:|fw:|fwd:)\\s*", "")
            .replaceAll("(?iu)\\b(votre|your|my|the|une|a)\\s+(application|candidature)\\b", "")
            .replaceAll("(?iu)\\b(application|candidature)\\s+(received|reçue|recue|update|status)\\b", "")
            .replace(company, "")
            .replaceAll("^[\\s:|\\-–—]+|[\\s:|\\-–—]+$", "")
            .trim();
        if (cleanedSubject.length() >= 5 && cleanedSubject.length() <= 120 && !looksGenericSubject(cleanedSubject)) {
            return cleanedSubject;
        }
        return "";
    }

    private static String cleanPosition(String value, String company) {
        String result = safe(value).replaceAll("[\"”]", "").trim();
        result = result.replaceAll("(?iu)\\s+(?:at|chez|with)\\s+.*$", "");
        result = result.replaceAll("\\s+[\\-–—|]\\s+.*$", "");
        if (!company.isBlank()) result = result.replace(company, "");
        return result.replaceAll("[\\s.,;:]+$", "").trim();
    }

    private static String cleanCompanyName(String value) {
        String cleaned = safe(value)
            .replaceAll("[\"<>]", " ")
            .replaceAll("(?iu)\\b(no[ -]?reply|noreply|recruiting|recruitment|careers?|jobs?|talent(?: acquisition)?|hiring|team|notifications?|application|candidature|rh|hr)\\b", " ")
            .replaceAll("[_|/\\-]+", " ")
            .replaceAll("\\s+", " ")
            .trim();
        return truncate(cleaned, 180);
    }

    private static boolean isUsefulCompany(String company) {
        if (company == null || company.length() < 2) return false;
        String normalized = company.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
        if (normalized.length() < 2) return false;
        return GENERIC_COMPANY_NAMES.stream().noneMatch(name -> normalized.equals(name.replaceAll("[^a-z0-9]+", "")));
    }

    private static String companyFromDomain(String email) {
        int at = email.indexOf('@');
        if (at < 0 || at + 1 >= email.length()) return "";
        String domain = email.substring(at + 1).toLowerCase(Locale.ROOT);
        if (GENERIC_DOMAINS.contains(domain)) return "";
        for (String generic : GENERIC_DOMAINS) {
            if (domain.endsWith("." + generic)) return "";
        }
        String[] labels = domain.split("\\.");
        if (labels.length < 2) return "";
        int index = labels.length - 2;
        if (("co".equals(labels[index]) || "com".equals(labels[index])) && labels.length >= 3) index--;
        String token = labels[index].replaceAll("[^a-z0-9-]", "");
        if (token.length() < 2) return "";
        String spaced = token.replace('-', ' ');
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    private static String extractDisplayName(String sender) {
        if (sender == null || sender.isBlank()) return "";
        int bracket = sender.indexOf('<');
        String value = bracket > 0 ? sender.substring(0, bracket) : sender;
        if (EMAIL_PATTERN.matcher(value).find()) return "";
        return value.replaceAll("^[\\s\"]+|[\\s\"]+$", "").trim();
    }

    private static String extractEmail(String sender) {
        Matcher matcher = EMAIL_PATTERN.matcher(safe(sender));
        return matcher.find() ? matcher.group().toLowerCase(Locale.ROOT) : "";
    }

    private static boolean looksLikeApplicationContext(String text) {
        String normalized = text.toLowerCase(Locale.ROOT);
        return normalized.contains("application") || normalized.contains("candidature")
            || normalized.contains("position") || normalized.contains("poste")
            || normalized.contains("interview") || normalized.contains("entretien")
            || normalized.contains("recruit") || normalized.contains("hiring");
    }

    private static boolean looksGenericSubject(String value) {
        String normalized = value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        return normalized.equals("merci") || normalized.equals("thank you") || normalized.equals("update")
            || normalized.equals("status update") || normalized.equals("next steps") || normalized.equals("prochaine etape")
            || normalized.equals("prochaine étape");
    }

    private static ContractType detectContractType(String text) {
        String normalized = text.toLowerCase(Locale.ROOT);
        if (normalized.matches("(?s).*\\bfreelance\\b.*") || normalized.contains("indépendant") || normalized.contains("independant")) return ContractType.FREELANCE;
        if (normalized.matches("(?s).*\\balternance\\b.*") || normalized.contains("apprentissage")) return ContractType.ALTERNANCE;
        if (normalized.matches("(?s).*\\bstage\\b.*") || normalized.contains("internship")) return ContractType.STAGE;
        if (normalized.matches("(?s).*\\bcdd\\b.*") || normalized.contains("fixed-term")) return ContractType.CDD;
        if (normalized.matches("(?s).*\\bcdi\\b.*") || normalized.contains("permanent contract")) return ContractType.CDI;
        return ContractType.AUTRE;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    record DiscoveryCandidate(
        String company,
        String position,
        LocalDate applicationDate,
        LocalDate responseDate,
        ContractType contractType,
        String recruiterName,
        String recruiterEmail,
        RecruitmentStage stage,
        String notes
    ) {}
}
