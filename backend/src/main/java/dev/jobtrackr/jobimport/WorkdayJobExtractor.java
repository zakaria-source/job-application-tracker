package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class WorkdayJobExtractor implements PlatformJobExtractor {

    @Override
    public boolean supports(URI url) {
        if (url == null || url.getHost() == null) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("myworkdayjobs.com")
            || host.endsWith(".myworkdayjobs.com")
            || host.equals("myworkdaysite.com")
            || host.endsWith(".myworkdaysite.com");
    }

    @Override
    public Optional<JobImportPreview> extract(FetchedJobPage page, JobImportPreview fallback) {
        Document document = page.document();
        String position = PlatformExtractionSupport.selectorText(document,
            "[data-automation-id=jobPostingHeader]",
            "[data-automation-id=jobPostingTitle]",
            "h1");
        String company = PlatformExtractionSupport.selectorText(document,
            "[data-automation-id=jobPostingCompany]",
            "[data-automation-id=company]");
        String location = PlatformExtractionSupport.selectorText(document,
            "[data-automation-id=locations]",
            "[data-automation-id=jobPostingLocation]",
            "[data-automation-id=location]");
        String description = PlatformExtractionSupport.selectorText(document,
            "[data-automation-id=jobPostingDescription]",
            "[data-automation-id=jobPostingDescriptionContent]");
        String employmentType = PlatformExtractionSupport.selectorText(document,
            "[data-automation-id=jobPostingJobType]",
            "[data-automation-id=jobType]",
            "[data-automation-id=timeType]");
        String salary = PlatformExtractionSupport.selectorText(document,
            "[data-automation-id=salary]",
            "[data-automation-id=compensation]");
        String date = dateFromPage(document);

        return Optional.of(PlatformExtractionSupport.preview(
            fallback,
            "WORKDAY",
            company,
            position,
            location,
            description,
            employmentType,
            salary,
            PlatformExtractionSupport.parseDate(date),
            fallback.canonicalUrl(),
            List.of()
        ));
    }

    private String dateFromPage(Document document) {
        Element automated = document.selectFirst("[data-automation-id=postedOn] time[datetime], [data-automation-id=postedOn][datetime]");
        if (automated != null && !automated.attr("datetime").isBlank()) return automated.attr("datetime");
        Element time = document.selectFirst("time[datetime]");
        return time == null ? "" : time.attr("datetime");
    }
}
