package dev.jobtrackr.application;

import dev.jobtrackr.application.dto.ApplicationRequest;
import dev.jobtrackr.application.dto.ApplicationResponse;
import dev.jobtrackr.application.dto.ImportSummary;
import dev.jobtrackr.application.dto.StageRequest;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications")
@Validated
public class ApplicationController {

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public List<ApplicationResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return applicationService.list(CurrentUser.id(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationResponse create(@AuthenticationPrincipal Jwt jwt,
                                      @Valid @RequestBody ApplicationRequest request) {
        return applicationService.create(CurrentUser.id(jwt), request);
    }

    @PutMapping("/{id}")
    public ApplicationResponse update(@AuthenticationPrincipal Jwt jwt,
                                      @PathVariable UUID id,
                                      @Valid @RequestBody ApplicationRequest request) {
        return applicationService.update(CurrentUser.id(jwt), id, request);
    }

    @PatchMapping("/{id}/stage")
    public ApplicationResponse move(@AuthenticationPrincipal Jwt jwt,
                                    @PathVariable UUID id,
                                    @Valid @RequestBody StageRequest request) {
        return applicationService.move(CurrentUser.id(jwt), id, request.stage());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        applicationService.delete(CurrentUser.id(jwt), id);
    }

    @PostMapping("/import")
    public ImportSummary importApplications(
        @AuthenticationPrincipal Jwt jwt,
        @RequestBody @Size(max = 1000) List<@Valid ApplicationRequest> requests
    ) {
        return applicationService.importApplications(CurrentUser.id(jwt), requests);
    }
}
