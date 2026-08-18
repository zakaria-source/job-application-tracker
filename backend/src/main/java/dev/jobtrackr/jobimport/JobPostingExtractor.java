package dev.jobtrackr.jobimport;

import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class JobPostingExtractor {

    private static final int DESCRIPTION_LIMIT = 8_000;
    private final JsonMapper jsonMapper;

    public JobPostingExtractor(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public JobImportPreview extract(FetchedJobPage page) {
        Document document = page.document();
        Optional<JsonNode> structured = findStructuredJobPosting(document);

        String position;
        String company;
        String location;
        String description;
        String employmentType;
        String salary;
        LocalDate datePosted;
        String extractionSource;

        if (structured.isPresent()) {
            JsonNode job = structured.get();
            position = clean(text(job, "title"), 220);
            company = clean(text(child(job, "hiringOrganization"), "name"), 180);
            location = clean(extractLocation(job), 240);
            description = cleanDescription(text(job, "description"));
            employmentType = clean(extractTextOrArray(job.get("employmentType")), 120);
            salary = clean(extractSalary(job.get("baseSalary")), 160);
            datePosted = parseDate(text(job, "datePosted"));
            extractionSource = "JSON_LD";
        } else {
            position = clean(firstNonBlank(
                meta(document, "property", "og:title"),
                textOf(document.selectFirst("[itemprop=title]")),
                textOf(document.selectFirst("h1")),
                document.title()), 220);
            company = clean(firstNonBlank(
                textOf(document.selectFirst("[itemprop=hiringOrganization] [itemprop=name]")),
                attributeOf(document.selectFirst("[itemprop=hiringOrganization]"), "content"),
                meta(document, "property", "og:site_name")), 180);
            location = clean(firstNonBlank(
                textOf(document.selectFirst("[itemprop=jobLocation]")),
                attributeOf(document.selectFirst("[itemprop=jobLocation]"), "content")), 240);
            description = cleanDescription(firstNonBlank(
                textOf(document.selectFirst("[itemprop=description]")),
                meta(document, "name", "description"),
                meta(document, "property", "og:description")));
            employmentType = clean(firstNonBlank(
                textOf(document.selectFirst("[itemprop=employmentType]")),
                attributeOf(document.selectFirst("[itemprop=employmentType]"), "content")), 120);
            salary = "";
            datePosted = parseDate(firstNonBlank(
                attributeOf(document.selectFirst("[itemprop=datePosted]"), "content"),
                textOf(document.selectFirst("[itemprop=datePosted]"))));
            extractionSource = "HTML";
        }

        String canonical = canonicalUrl(document, page.url().toString());
        ContractType contractType = detectContractType(position + " " + employmentType + " " + description);
        List<String> warnings = warnings(position, company, description, extractionSource);
        String confidence = !position.isBlank() && !company.isBlank()
            ? (structured.isPresent() ? "HIGH" : "MEDIUM")
            : "LOW";

        return new JobImportPreview(
            page.url().toString(), canonical, company, position, location, description,
            contractType, employmentType, salary, datePosted, extractionSource, confidence, warnings
        );
    }

    private Optional<JsonNode> findStructuredJobPosting(Document document) {
        for (Element script : document.select("script[type=application/ld+json]")) {
            try {
                JsonNode root = jsonMapper.readTree(script.data());
                Optional<JsonNode> found = findJobPosting(root);
                if (found.isPresent()) return found;
            } catch (Exception ignored) {
                // Malformed JSON-LD must not prevent HTML fallback extraction.
            }
        }
        return Optional.empty();
    }

    private Optional<JsonNode> findJobPosting(JsonNode node) {
        if (node == null || node.isNull()) return Optional.empty();
        if (isJobPosting(node)) return Optional.of(node);
        if (node.isArray()) {
            for (JsonNode child : node) {
                Optional<JsonNode> found = findJobPosting(child);
                if (found.isPresent()) return found;
            }
        }
        JsonNode graph = node.get("@graph");
        if (graph != null && graph.isArray()) {
            for (JsonNode child : graph) {
                if (isJobPosting(child)) return Optional.of(child);
            }
        }
        return Optional.empty();
    }

    private boolean isJobPosting(JsonNode node) {
        if (!node.isObject()) return false;
        JsonNode type = node.get("@type");
        if (type == null) return false;
        if (type.isArray()) {
            for (JsonNode value : type) if ("JobPosting".equalsIgnoreCase(value.asText())) return true;
            return false;
        }
        return "JobPosting".equalsIgnoreCase(type.asText());
    }

    private String extractLocation(JsonNode job) {
        List<String> parts = new ArrayList<>();
        JsonNode locationNode = job.get("jobLocation");
        if (locationNode != null) {
            if (locationNode.isArray()) {
                for (JsonNode location : locationNode) addLocation(parts, location);
            } else {
                addLocation(parts, locationNode);
            }
        }
        if ("TELECOMMUTE".equalsIgnoreCase(text(job, "jobLocationType"))) parts.add("Télétravail");
        JsonNode applicantLocation = job.get("applicantLocationRequirements");
        if (parts.isEmpty() && applicantLocation != null) {
            if (applicantLocation.isArray()) {
                for (JsonNode item : applicantLocation) addIfPresent(parts, text(item, "name"));
            } else {
                addIfPresent(parts, text(applicantLocation, "name"));
            }
        }
        return String.join(" · ", parts.stream().distinct().toList());
    }

    private void addLocation(List<String> parts, JsonNode location) {
        JsonNode address = child(location, "address");
        String locality = text(address, "addressLocality");
        String region = text(address, "addressRegion");
        String country = text(address, "addressCountry");
        if (country.isBlank()) country = text(child(address, "addressCountry"), "name");
        String combined = String.join(", ", List.of(locality, region, country).stream().filter(value -> !value.isBlank()).toList());
        addIfPresent(parts, firstNonBlank(combined, text(location, "name")));
    }

    private String extractSalary(JsonNode salaryNode) {
        if (salaryNode == null || salaryNode.isNull()) return "";
        String currency = text(salaryNode, "currency");
        JsonNode value = salaryNode.get("value");
        if (value == null) return firstNonBlank(text(salaryNode, "value"), currency);
        if (!value.isObject()) return joinSalary(value.asText(), currency, "");
        String exact = text(value, "value");
        String min = text(value, "minValue");
        String max = text(value, "maxValue");
        String unit = text(value, "unitText");
        String amount = !exact.isBlank() ? exact : (!min.isBlank() && !max.isBlank() ? min + " - " + max : firstNonBlank(min, max));
        return joinSalary(amount, currency, unit);
    }

    private String joinSalary(String amount, String currency, String unit) {
        if (amount.isBlank()) return "";
        String result = amount + (currency.isBlank() ? "" : " " + currency);
        return unit.isBlank() ? result : result + " / " + unit;
    }

    private ContractType detectContractType(String raw) {
        String value = raw.toLowerCase(Locale.ROOT);
        if (containsWord(value, "alternance") || containsWord(value, "apprentissage") || containsWord(value, "apprenticeship")) return ContractType.ALTERNANCE;
        if (containsWord(value, "stage") || containsWord(value, "internship") || containsWord(value, "intern")) return ContractType.STAGE;
        if (containsWord(value, "freelance") || containsWord(value, "contractor")) return ContractType.FREELANCE;
        if (containsWord(value, "cdd") || containsWord(value, "temporary")) return ContractType.CDD;
        if (containsWord(value, "cdi") || containsWord(value, "permanent")) return ContractType.CDI;
        return ContractType.AUTRE;
    }

    private boolean containsWord(String value, String word) {
        return value.matches("(?s).*\\b" + java.util.regex.Pattern.quote(word) + "\\b.*");
    }

    private List<String> warnings(String position, String company, String description, String source) {
        List<String> warnings = new ArrayList<>();
        if (position.isBlank()) warnings.add("Le poste n’a pas pu être identifié automatiquement.");
        if (company.isBlank()) warnings.add("L’entreprise n’a pas pu être identifiée automatiquement.");
        if (description.isBlank()) warnings.add("La description n’est pas exposée dans le HTML public de cette page.");
        if ("HTML".equals(source)) warnings.add("Cette page n’expose pas de JobPosting structuré : vérifiez les champs avant de continuer.");
        return warnings;
    }

    private String canonicalUrl(Document document, String fallback) {
        Element canonical = document.selectFirst("link[rel=canonical][href]");
        if (canonical == null) return fallback;
        String absolute = canonical.absUrl("href");
        return absolute.isBlank() ? fallback : absolute;
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        try {
            return LocalDate.parse(value.length() >= 10 ? value.substring(0, 10) : value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String cleanDescription(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return clean(Jsoup.parseBodyFragment(raw).text(), DESCRIPTION_LIMIT);
    }

    private String meta(Document document, String attribute, String value) {
        Element element = document.selectFirst("meta[" + attribute + "=\"" + value + "\"]");
        return element == null ? "" : element.attr("content").trim();
    }

    private String textOf(Element element) { return element == null ? "" : element.text().trim(); }
    private String attributeOf(Element element, String attribute) { return element == null ? "" : element.attr(attribute).trim(); }
    private JsonNode child(JsonNode node, String field) { return node == null ? null : node.get(field); }
    private String text(JsonNode node, String field) { JsonNode value = child(node, field); return value == null || value.isNull() ? "" : value.asText().trim(); }

    private String extractTextOrArray(JsonNode node) {
        if (node == null || node.isNull()) return "";
        if (!node.isArray()) return node.asText().trim();
        List<String> values = new ArrayList<>();
        for (JsonNode child : node) addIfPresent(values, child.asText().trim());
        return String.join(", ", values);
    }

    private void addIfPresent(List<String> values, String value) { if (value != null && !value.isBlank()) values.add(value.trim()); }
    private String firstNonBlank(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return ""; }
    private String clean(String value, int max) { String normalized = value == null ? "" : value.replaceAll("\\s+", " ").trim(); return normalized.length() <= max ? normalized : normalized.substring(0, max).trim(); }
}
