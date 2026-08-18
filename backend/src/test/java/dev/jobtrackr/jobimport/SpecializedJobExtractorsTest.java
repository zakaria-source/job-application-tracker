package dev.jobtrackr.jobimport;

import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SpecializedJobExtractorsTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Test
    void enrichesGreenhouseJobsFromThePublicJobBoardApi() {
        PublicJsonFetcher api = uri -> json("""
            {
              "title": "Senior Backend Engineer",
              "company_name": "Acme",
              "first_published": "2026-08-10T10:00:00Z",
              "location": {"name": "Paris, France"},
              "content": "<p>CDI · Java et Spring Boot.</p>",
              "absolute_url": "https://job-boards.greenhouse.io/acme/jobs/12345",
              "pay_input_ranges": [{"min_cents": 6500000, "max_cents": 7500000, "currency_type": "EUR"}]
            }
            """);
        GreenhouseJobExtractor extractor = new GreenhouseJobExtractor(api);
        FetchedJobPage page = page("https://job-boards.greenhouse.io/acme/jobs/12345", "<html><body><h1>Backend</h1></body></html>");

        JobImportPreview result = extractor.extract(page, fallback(page.url().toString())).orElseThrow();

        assertThat(result.extractionSource()).isEqualTo("GREENHOUSE_API");
        assertThat(result.position()).isEqualTo("Senior Backend Engineer");
        assertThat(result.company()).isEqualTo("Acme");
        assertThat(result.location()).isEqualTo("Paris, France");
        assertThat(result.salary()).contains("65000").contains("75000").contains("EUR");
        assertThat(result.contractType()).isEqualTo(ContractType.CDI);
        assertThat(result.datePosted()).hasToString("2026-08-10");
        assertThat(result.confidence()).isEqualTo("HIGH");
    }

    @Test
    void enrichesLeverJobsFromThePublicPostingsApi() {
        PublicJsonFetcher api = uri -> json("""
            {
              "text": "Platform Engineer",
              "categories": {"location": "Paris", "commitment": "Permanent"},
              "descriptionPlain": "Build Kubernetes platforms.",
              "lists": [{"text": "Stack", "content": "<ul><li>Java</li><li>Kubernetes</li></ul>"}],
              "additionalPlain": "Hybrid team",
              "workplaceType": "hybrid",
              "hostedUrl": "https://jobs.eu.lever.co/acme/abc-123",
              "salaryRange": {"min": 65000, "max": 78000, "currency": "EUR", "interval": "per-year-salary"}
            }
            """);
        LeverJobExtractor extractor = new LeverJobExtractor(api);
        FetchedJobPage page = page("https://jobs.eu.lever.co/acme/abc-123", "<html><head><meta property='og:site_name' content='Lever'></head></html>");

        JobImportPreview result = extractor.extract(page, fallback(page.url().toString())).orElseThrow();

        assertThat(result.extractionSource()).isEqualTo("LEVER_API");
        assertThat(result.position()).isEqualTo("Platform Engineer");
        assertThat(result.company()).isEqualTo("Acme");
        assertThat(result.location()).isEqualTo("Paris");
        assertThat(result.employmentType()).contains("Permanent").contains("hybrid");
        assertThat(result.description()).contains("Kubernetes platforms").contains("Java");
        assertThat(result.salary()).contains("65000").contains("78000").contains("EUR");
        assertThat(result.contractType()).isEqualTo(ContractType.CDI);
        assertThat(result.warnings()).anyMatch(value -> value.contains("déduite du site Lever"));
    }

    @Test
    void fillsWorkdaySpecificFieldsFromPublicHtml() {
        String html = """
            <html><body>
              <h1 data-automation-id="jobPostingHeader">Java Software Engineer</h1>
              <div data-automation-id="jobPostingCompany">Air Example</div>
              <div data-automation-id="locations">Paris Area</div>
              <div data-automation-id="jobPostingJobType">CDI</div>
              <div data-automation-id="jobPostingDescription"><p>Spring Boot, Kafka and cloud.</p></div>
              <time datetime="2026-08-18"></time>
            </body></html>
            """;
        FetchedJobPage page = page("https://example.wd3.myworkdayjobs.com/en-US/careers/job/Paris/Java_JR123", html);

        JobImportPreview result = new WorkdayJobExtractor().extract(page, fallback(page.url().toString())).orElseThrow();

        assertThat(result.extractionSource()).isEqualTo("WORKDAY");
        assertThat(result.position()).isEqualTo("Java Software Engineer");
        assertThat(result.company()).isEqualTo("Air Example");
        assertThat(result.location()).isEqualTo("Paris Area");
        assertThat(result.contractType()).isEqualTo(ContractType.CDI);
        assertThat(result.description()).contains("Spring Boot").contains("Kafka");
        assertThat(result.datePosted()).hasToString("2026-08-18");
    }

    @Test
    void fillsWelcomeToTheJungleFieldsAndCanInferCompanyFromThePublicUrl() {
        String html = """
            <html><body>
              <h1 data-testid="job-title">Backend Engineer</h1>
              <div data-testid="job-metadata-location">Paris</div>
              <div data-testid="job-contract-type">CDI</div>
              <section data-testid="job-section-description">Java, Spring Boot et Kafka.</section>
              <div data-testid="job-salary">65K€ - 75K€</div>
            </body></html>
            """;
        FetchedJobPage page = page("https://www.welcometothejungle.com/fr/companies/nova-labs/jobs/backend-engineer_paris", html);

        JobImportPreview result = new WelcomeToTheJungleJobExtractor().extract(page, fallback(page.url().toString())).orElseThrow();

        assertThat(result.extractionSource()).isEqualTo("WELCOME_TO_THE_JUNGLE");
        assertThat(result.position()).isEqualTo("Backend Engineer");
        assertThat(result.company()).isEqualTo("Nova Labs");
        assertThat(result.location()).isEqualTo("Paris");
        assertThat(result.salary()).isEqualTo("65K€ - 75K€");
        assertThat(result.contractType()).isEqualTo(ContractType.CDI);
        assertThat(result.warnings()).anyMatch(value -> value.contains("déduite de l’URL"));
    }

    private FetchedJobPage page(String url, String html) {
        return new FetchedJobPage(URI.create(url), Jsoup.parse(html, url));
    }

    private JobImportPreview fallback(String url) {
        return new JobImportPreview(url, url, "", "", "", "", ContractType.AUTRE, "", "", null, "HTML", "LOW", List.of());
    }

    private JsonNode json(String value) {
        try {
            return jsonMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException(exception);
        }
    }
}
