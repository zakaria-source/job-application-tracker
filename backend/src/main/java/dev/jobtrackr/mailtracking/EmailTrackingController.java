package dev.jobtrackr.mailtracking;

import dev.jobtrackr.mailtracking.dto.EmailAnalysisRequest;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisResponse;
import dev.jobtrackr.mailtracking.dto.EmailApplyRequest;
import dev.jobtrackr.mailtracking.dto.EmailApplyResponse;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/mail-tracking")
public class EmailTrackingController {
    private final EmailTrackingService service;

    public EmailTrackingController(EmailTrackingService service) {
        this.service = service;
    }

    @PostMapping("/analyze")
    public EmailAnalysisResponse analyze(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody EmailAnalysisRequest request
    ) {
        return service.analyze(CurrentUser.id(jwt), request);
    }

    @PostMapping("/apply")
    public EmailApplyResponse apply(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody EmailApplyRequest request
    ) {
        return service.apply(CurrentUser.id(jwt), request);
    }
}
