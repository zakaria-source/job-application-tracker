package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class WelcomeToTheJungleJobExtractor implements PlatformJobExtractor {

    @Override
    public boolean supports(URI url) {
        if (url == null || url.getHost() == null) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("welcometothejungle.com") || host.endsWith(".welcometothejungle.com");
    }

    @Override
    public Optional<JobImportPreview> extract(FetchedJobPage page, JobImportPreview fallback) {
        Document document = page.document();
        String position = PlatformExtractionSupport.selectorText(document,
            "[data-testid=job-title]",
            "h1");
        String company = PlatformExtractionSupport.selectorText(document,
            "[data-testid=company-name]",
            "a[href*='/companies/']");
        String location = PlatformExtractionSupport.selectorText(document,
            "[data-testid=job-metadata-location]",
            "[data-testid=job-location]",
            "[data-testid=location]");
        String description = PlatformExtractionSupport.selectorText(document,
            "[data-testid=job-section-description]",
            "[data-testid=job-description]",
            "section[id*=description]");
        String employmentType = PlatformExtractionSupport.selectorText(document,
            "[data-testid=job-contract-type]",
            "[data-testid=contract-type]");
        String salary = PlatformExtractionSupport.selectorText(document,
            "[data-testid=job-salary]",
            "[data-testid=salary]");

        List<String> warnings = new ArrayList<>();
        if ((company == null || company.isBlank()) && (fallback.company() == null || fallback.company().isBlank())) {
            company = companyFromPath(page.url());
            if (!company.isBlank()) warnings.add("L’entreprise a été déduite de l’URL Welcome to the Jungle : vérifiez-la avant l’ajout.");
        }

        return Optional.of(PlatformExtractionSupport.preview(
            fallback,
            "WELCOME_TO_THE_JUNGLE",
            company,
            position,
            location,
            description,
            employmentType,
            salary,
            fallback.datePosted(),
            fallback.canonicalUrl(),
            warnings
        ));
    }

    private String companyFromPath(URI url) {
        String[] segments = url.getPath().split("/");
        for (int index = 0; index < segments.length - 1; index++) {
            if ("companies".equalsIgnoreCase(segments[index]) && !segments[index + 1].isBlank()) {
                return PlatformExtractionSupport.humanizeSlug(segments[index + 1]);
            }
        }
        return "";
    }
}
