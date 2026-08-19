package dev.jobtrackr.jobimport;

import dev.jobtrackr.common.RateLimitService;
import dev.jobtrackr.common.ServiceBusyException;
import dev.jobtrackr.jobimport.dto.JobImportPreview;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Semaphore;

@Service
public class JobImportService {
    private static final Duration IMPORT_WINDOW = Duration.ofMinutes(1);
    private static final Semaphore IMPORT_BULKHEAD = new Semaphore(4, true);

    private final SafeJobPageFetcher fetcher;
    private final JobPostingExtractor genericExtractor;
    private final List<PlatformJobExtractor> platformExtractors;
    private final RateLimitService rateLimits;

    public JobImportService(
        SafeJobPageFetcher fetcher,
        JobPostingExtractor genericExtractor,
        List<PlatformJobExtractor> platformExtractors,
        RateLimitService rateLimits
    ) {
        this.fetcher = fetcher;
        this.genericExtractor = genericExtractor;
        this.platformExtractors = List.copyOf(platformExtractors);
        this.rateLimits = rateLimits;
    }

    public JobImportPreview preview(UUID userId, String url) {
        rateLimits.check("job-import:" + userId, 10, IMPORT_WINDOW);
        if (!IMPORT_BULKHEAD.tryAcquire()) {
            throw new ServiceBusyException("Trop d’analyses d’offres sont déjà en cours. Réessayez dans quelques instants.");
        }
        try {
            FetchedJobPage page = fetcher.fetch(url);
            JobImportPreview fallback = genericExtractor.extract(page);

            for (PlatformJobExtractor extractor : platformExtractors) {
                if (!extractor.supports(page.url())) continue;
                Optional<JobImportPreview> specialized = extractor.extract(page, fallback);
                if (specialized.isPresent()) return specialized.get();
            }
            return fallback;
        } finally {
            IMPORT_BULKHEAD.release();
        }
    }
}
