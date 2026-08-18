package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class LeverJobExtractor implements PlatformJobExtractor {

    private static final Pattern JOB_PATH = Pattern.compile("^/([^/]+)/([^/?#]+)(?:/.*)?$");
    private static final Pattern SAFE_TOKEN = Pattern.compile("^[A-Za-z0-9_-]+$");

    private final PublicJsonFetcher jsonFetcher;

    public LeverJobExtractor(PublicJsonFetcher jsonFetcher) {
        this.jsonFetcher = jsonFetcher;
    }

    @Override
    public boolean supports(URI url) {
        if (url == null || url.getHost() == null) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("jobs.lever.co") || host.equals("jobs.eu.lever.co");
    }

    @Override
    public Optional<JobImportPreview> extract(FetchedJobPage page, JobImportPreview fallback) {
        Matcher matcher = JOB_PATH.matcher(page.url().getPath());
        if (!matcher.matches()) return Optional.empty();

        String site = matcher.group(1);
        String postingId = matcher.group(2);
        if (!SAFE_TOKEN.matcher(site).matches() || !SAFE_TOKEN.matcher(postingId).matches()) return Optional.empty();

        try {
            boolean eu = page.url().getHost().equalsIgnoreCase("jobs.eu.lever.co");
            String apiHost = eu ? "api.eu.lever.co" : "api.lever.co";
            JsonNode job = jsonFetcher.fetch(URI.create("https://" + apiHost + "/v0/postings/" + site + "/" + postingId));

            JsonNode categories = job.get("categories");
            String position = text(job, "text");
            String location = text(categories, "location");
            String commitment = text(categories, "commitment");
            String workplaceType = text(job, "workplaceType");
            String employmentType = String.join(" · ", List.of(commitment, workplaceType).stream().filter(value -> !value.isBlank()).distinct().toList());
            String description = description(job);
            String salary = salary(job.get("salaryRange"));
            String canonical = PlatformExtractionSupport.safeHttps(text(job, "hostedUrl"), fallback.canonicalUrl());

            List<String> warnings = new ArrayList<>();
            String company = fallback.company();
            if (company == null || company.isBlank() || "Lever".equalsIgnoreCase(company.trim())) {
                company = PlatformExtractionSupport.humanizeSlug(site);
                if (!company.isBlank()) warnings.add("L’entreprise a été déduite du site Lever : vérifiez-la avant l’ajout.");
            }

            return Optional.of(PlatformExtractionSupport.preview(
                fallback,
                "LEVER_API",
                company,
                position,
                location,
                description,
                employmentType,
                salary,
                fallback.datePosted(),
                canonical,
                warnings
            ));
        } catch (JobImportException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private String description(JsonNode job) {
        List<String> parts = new ArrayList<>();
        add(parts, text(job, "descriptionPlain"));
        JsonNode lists = job.get("lists");
        if (lists != null && lists.isArray()) {
            for (JsonNode list : lists) {
                add(parts, text(list, "text"));
                add(parts, PlatformExtractionSupport.cleanDescription(text(list, "content")));
            }
        }
        add(parts, text(job, "additionalPlain"));
        return PlatformExtractionSupport.clean(String.join("\n", parts), 8_000);
    }

    private String salary(JsonNode range) {
        if (range == null || range.isNull()) return "";
        String min = scalar(range.get("min"));
        String max = scalar(range.get("max"));
        String amount = !min.isBlank() && !max.isBlank() ? min + " - " + max : PlatformExtractionSupport.firstNonBlank(min, max);
        if (amount.isBlank()) return text(range, "salaryDescriptionPlain");
        String currency = text(range, "currency");
        String interval = text(range, "interval");
        String result = amount + (currency.isBlank() ? "" : " " + currency);
        return interval.isBlank() ? result : result + " / " + interval;
    }

    private String scalar(JsonNode node) {
        return node == null || node.isNull() ? "" : node.asText().trim();
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isNull()) return "";
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asText().trim();
    }

    private void add(List<String> parts, String value) {
        if (value != null && !value.isBlank()) parts.add(value.trim());
    }
}
