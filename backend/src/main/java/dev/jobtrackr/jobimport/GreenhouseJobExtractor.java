package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class GreenhouseJobExtractor implements PlatformJobExtractor {

    private static final Pattern JOB_PATH = Pattern.compile("^/([^/]+)/jobs/(\\d+)(?:/.*)?$");
    private static final Pattern SAFE_TOKEN = Pattern.compile("^[A-Za-z0-9_-]+$");

    private final PublicJsonFetcher jsonFetcher;

    public GreenhouseJobExtractor(PublicJsonFetcher jsonFetcher) {
        this.jsonFetcher = jsonFetcher;
    }

    @Override
    public boolean supports(URI url) {
        if (url == null || url.getHost() == null) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("boards.greenhouse.io") || host.equals("job-boards.greenhouse.io");
    }

    @Override
    public Optional<JobImportPreview> extract(FetchedJobPage page, JobImportPreview fallback) {
        Matcher matcher = JOB_PATH.matcher(page.url().getPath());
        if (!matcher.matches()) return Optional.empty();

        String board = matcher.group(1);
        String jobId = matcher.group(2);
        if (!SAFE_TOKEN.matcher(board).matches() || !SAFE_TOKEN.matcher(jobId).matches()) return Optional.empty();

        try {
            URI apiUri = URI.create("https://boards-api.greenhouse.io/v1/boards/" + board + "/jobs/" + jobId);
            JsonNode job = jsonFetcher.fetch(apiUri);
            String position = text(job, "title");
            String company = text(job, "company_name");
            String location = text(job.get("location"), "name");
            String description = PlatformExtractionSupport.cleanDescription(text(job, "content"));
            String salary = salary(job.get("pay_input_ranges"));
            String canonical = PlatformExtractionSupport.safeHttps(text(job, "absolute_url"), fallback.canonicalUrl());

            return Optional.of(PlatformExtractionSupport.preview(
                fallback,
                "GREENHOUSE_API",
                company,
                position,
                location,
                description,
                fallback.employmentType(),
                salary,
                PlatformExtractionSupport.parseDate(text(job, "first_published")),
                canonical,
                List.of()
            ));
        } catch (JobImportException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private String salary(JsonNode ranges) {
        if (ranges == null || !ranges.isArray() || ranges.isEmpty()) return "";
        JsonNode range = ranges.get(0);
        String min = cents(range.get("min_cents"));
        String max = cents(range.get("max_cents"));
        String amount = !min.isBlank() && !max.isBlank() ? min + " - " + max : PlatformExtractionSupport.firstNonBlank(min, max);
        if (amount.isBlank()) return "";
        String currency = text(range, "currency_type");
        return currency.isBlank() ? amount : amount + " " + currency;
    }

    private String cents(JsonNode value) {
        if (value == null || value.isNull() || !value.isNumber()) return "";
        return BigDecimal.valueOf(value.asLong(), 2).stripTrailingZeros().toPlainString();
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isNull()) return "";
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asText().trim();
    }
}
