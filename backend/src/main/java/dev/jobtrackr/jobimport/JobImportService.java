package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.springframework.stereotype.Service;

@Service
public class JobImportService {

    private final SafeJobPageFetcher fetcher;
    private final JobPostingExtractor extractor;

    public JobImportService(SafeJobPageFetcher fetcher, JobPostingExtractor extractor) {
        this.fetcher = fetcher;
        this.extractor = extractor;
    }

    public JobImportPreview preview(String url) {
        return extractor.extract(fetcher.fetch(url));
    }
}
