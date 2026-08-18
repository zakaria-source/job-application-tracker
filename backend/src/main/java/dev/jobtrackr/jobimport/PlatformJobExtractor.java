package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;

import java.net.URI;
import java.util.Optional;

public interface PlatformJobExtractor {

    boolean supports(URI url);

    Optional<JobImportPreview> extract(FetchedJobPage page, JobImportPreview fallback);
}
