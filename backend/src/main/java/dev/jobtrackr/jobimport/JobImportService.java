package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class JobImportService {

    private final SafeJobPageFetcher fetcher;
    private final JobPostingExtractor genericExtractor;
    private final List<PlatformJobExtractor> platformExtractors;

    public JobImportService(
        SafeJobPageFetcher fetcher,
        JobPostingExtractor genericExtractor,
        List<PlatformJobExtractor> platformExtractors
    ) {
        this.fetcher = fetcher;
        this.genericExtractor = genericExtractor;
        this.platformExtractors = List.copyOf(platformExtractors);
    }

    public JobImportPreview preview(String url) {
        FetchedJobPage page = fetcher.fetch(url);
        JobImportPreview fallback = genericExtractor.extract(page);

        for (PlatformJobExtractor extractor : platformExtractors) {
            if (!extractor.supports(page.url())) continue;
            Optional<JobImportPreview> specialized = extractor.extract(page, fallback);
            if (specialized.isPresent()) return specialized.get();
        }
        return fallback;
    }
}
