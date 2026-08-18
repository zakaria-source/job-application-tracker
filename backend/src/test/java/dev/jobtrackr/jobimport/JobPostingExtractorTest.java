package dev.jobtrackr.jobimport;

import dev.jobtrackr.application.domain.ContractType;
import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class JobPostingExtractorTest {

    private final JobPostingExtractor extractor = new JobPostingExtractor(JsonMapper.builder().build());

    @Test
    void extractsStructuredJobPostingBeforeHtmlFallbacks() {
        String html = """
            <html><head>
              <link rel="canonical" href="https://jobs.example.com/backend-42">
              <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                "title": "Backend Engineer",
                "description": "<p>CDI · Build <strong>Java</strong> services.</p>",
                "datePosted": "2026-08-17",
                "employmentType": "FULL_TIME",
                "hiringOrganization": {"@type": "Organization", "name": "Acme"},
                "jobLocation": {"@type": "Place", "address": {"addressLocality": "Paris", "addressCountry": "FR"}},
                "baseSalary": {"currency": "EUR", "value": {"minValue": 60000, "maxValue": 70000, "unitText": "YEAR"}}
              }
              </script>
            </head><body><h1>Ignored fallback title</h1></body></html>
            """;

        JobImportPreview preview = extractor.extract(new FetchedJobPage(
            URI.create("https://jobs.example.com/backend-42?source=test"),
            Jsoup.parse(html, "https://jobs.example.com/backend-42")
        ));

        assertThat(preview.position()).isEqualTo("Backend Engineer");
        assertThat(preview.company()).isEqualTo("Acme");
        assertThat(preview.location()).contains("Paris");
        assertThat(preview.description()).contains("Build Java services");
        assertThat(preview.contractType()).isEqualTo(ContractType.CDI);
        assertThat(preview.salary()).contains("60000").contains("70000").contains("EUR");
        assertThat(preview.extractionSource()).isEqualTo("JSON_LD");
        assertThat(preview.confidence()).isEqualTo("HIGH");
    }

    @Test
    void fallsBackToPublicHtmlMetadata() {
        String html = """
            <html><head>
              <meta property="og:title" content="Software Engineer Java">
              <meta property="og:site_name" content="Nova Labs">
              <meta name="description" content="Stage de six mois autour de Spring Boot.">
            </head><body><h1>Software Engineer Java</h1></body></html>
            """;

        JobImportPreview preview = extractor.extract(new FetchedJobPage(
            URI.create("https://careers.example.org/jobs/java"),
            Jsoup.parse(html, "https://careers.example.org/jobs/java")
        ));

        assertThat(preview.position()).isEqualTo("Software Engineer Java");
        assertThat(preview.company()).isEqualTo("Nova Labs");
        assertThat(preview.contractType()).isEqualTo(ContractType.STAGE);
        assertThat(preview.extractionSource()).isEqualTo("HTML");
        assertThat(preview.warnings()).isNotEmpty();
    }
}
