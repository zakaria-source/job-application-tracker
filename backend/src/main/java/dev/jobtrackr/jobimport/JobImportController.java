package dev.jobtrackr.jobimport;

import dev.jobtrackr.jobimport.dto.JobImportPreview;
import dev.jobtrackr.jobimport.dto.JobImportRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/job-import")
public class JobImportController {

    private final JobImportService service;

    public JobImportController(JobImportService service) {
        this.service = service;
    }

    @PostMapping("/preview")
    public JobImportPreview preview(@Valid @RequestBody JobImportRequest request) {
        return service.preview(request.url());
    }
}
