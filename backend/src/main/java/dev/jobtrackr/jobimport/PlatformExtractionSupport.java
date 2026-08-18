package dev.jobtrackr.jobimport;

import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class PlatformExtractionSupport {

    private static final int DESCRIPTION_LIMIT = 8_000;

    private PlatformExtractionSupport() {
    }

    static JobImportPreview preview(
        JobImportPreview fallback,
        String source,
        String company,
        String position,
        String location,
        String description,
        String employmentType,
        String salary,
        LocalDate datePosted,
        String canonicalUrl,
        List<String> extraWarnings
    ) {
        String finalCompany = clean(firstNonBlank(company, fallback.company()), 180);
        String finalPosition = clean(firstNonBlank(position, fallback.position()), 220);
        String finalLocation = clean(firstNonBlank(location, fallback.location()), 240);
        String finalDescription = cleanDescription(firstNonBlank(description, fallback.description()));
        String finalEmploymentType = clean(firstNonBlank(employmentType, fallback.employmentType()), 120);
        String finalSalary = clean(firstNonBlank(salary, fallback.salary()), 160);
        LocalDate finalDate = datePosted != null ? datePosted : fallback.datePosted();
        String finalCanonical = safeHttps(firstNonBlank(canonicalUrl, fallback.canonicalUrl()), fallback.canonicalUrl());
        ContractType finalContract = detectContractType(
            finalPosition + " " + finalEmploymentType + " " + finalDescription,
            fallback.contractType()
        );

        List<String> warnings = new ArrayList<>();
        if (finalPosition.isBlank()) warnings.add("Le poste n’a pas pu être identifié automatiquement.");
        if (finalCompany.isBlank()) warnings.add("L’entreprise n’a pas pu être identifiée automatiquement.");
        if (finalDescription.isBlank()) warnings.add("La description n’est pas exposée dans les données publiques de cette page.");
        if (extraWarnings != null) warnings.addAll(extraWarnings.stream().filter(value -> value != null && !value.isBlank()).toList());

        String confidence = !finalPosition.isBlank() && !finalCompany.isBlank()
            ? (finalDescription.isBlank() ? "MEDIUM" : "HIGH")
            : "LOW";

        return new JobImportPreview(
            fallback.sourceUrl(), finalCanonical, finalCompany, finalPosition, finalLocation, finalDescription,
            finalContract, finalEmploymentType, finalSalary, finalDate, source, confidence, warnings.stream().distinct().toList()
        );
    }

    static String selectorText(Document document, String... selectors) {
        for (String selector : selectors) {
            Element element = document.selectFirst(selector);
            if (element != null && !element.text().isBlank()) return element.text().trim();
        }
        return "";
    }

    static String meta(Document document, String attribute, String value) {
        Element element = document.selectFirst("meta[" + attribute + "=\"" + value + "\"]");
        return element == null ? "" : element.attr("content").trim();
    }

    static String cleanDescription(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return clean(Jsoup.parseBodyFragment(raw).text(), DESCRIPTION_LIMIT);
    }

    static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        try {
            return LocalDate.parse(value.length() >= 10 ? value.substring(0, 10) : value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    static String safeHttps(String candidate, String fallback) {
        if (candidate == null || candidate.isBlank()) return fallback == null ? "" : fallback;
        try {
            URI uri = URI.create(candidate.trim());
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null ? uri.toString() : fallback;
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }

    static String humanizeSlug(String slug) {
        if (slug == null || slug.isBlank()) return "";
        String normalized = slug.replace('-', ' ').replace('_', ' ').replaceAll("\\s+", " ").trim();
        if (normalized.isBlank()) return "";
        StringBuilder result = new StringBuilder();
        for (String word : normalized.split(" ")) {
            if (!result.isEmpty()) result.append(' ');
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }

    static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "";
    }

    static String clean(String value, int max) {
        String normalized = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        return normalized.length() <= max ? normalized : normalized.substring(0, max).trim();
    }

    private static ContractType detectContractType(String raw, ContractType fallback) {
        String value = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (containsWord(value, "alternance") || containsWord(value, "apprentissage") || containsWord(value, "apprenticeship")) return ContractType.ALTERNANCE;
        if (containsWord(value, "stage") || containsWord(value, "internship") || containsWord(value, "intern")) return ContractType.STAGE;
        if (containsWord(value, "freelance") || containsWord(value, "contractor")) return ContractType.FREELANCE;
        if (containsWord(value, "cdd") || containsWord(value, "temporary") || containsWord(value, "fixed term")) return ContractType.CDD;
        if (containsWord(value, "cdi") || containsWord(value, "permanent")) return ContractType.CDI;
        return fallback == null ? ContractType.AUTRE : fallback;
    }

    private static boolean containsWord(String value, String word) {
        return value.matches("(?s).*\\b" + java.util.regex.Pattern.quote(word) + "\\b.*");
    }
}
