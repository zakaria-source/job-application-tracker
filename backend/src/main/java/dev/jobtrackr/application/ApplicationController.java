package dev.jobtrackr.application;

import dev.jobtrackr.application.ApplicationModels.ApplicationRequest;
import dev.jobtrackr.application.ApplicationModels.ApplicationResponse;
import dev.jobtrackr.application.ApplicationModels.ImportSummary;
import dev.jobtrackr.application.ApplicationModels.InterviewRequest;
import dev.jobtrackr.application.ApplicationModels.StageRequest;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications")
@Validated
public class ApplicationController {

    private final ApplicationService service;

    public ApplicationController(ApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<ApplicationResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(CurrentUser.id(jwt));
    }

    @GetMapping("/{id}")
    public ApplicationResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(CurrentUser.id(jwt), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationResponse create(@AuthenticationPrincipal Jwt jwt,
                                      @Valid @RequestBody ApplicationRequest request) {
        return service.create(CurrentUser.id(jwt), request);
    }

    @PutMapping("/{id}")
    public ApplicationResponse update(@AuthenticationPrincipal Jwt jwt,
                                      @PathVariable UUID id,
                                      @Valid @RequestBody ApplicationRequest request) {
        return service.update(CurrentUser.id(jwt), id, request);
    }

    @PatchMapping("/{id}/stage")
    public ApplicationResponse move(@AuthenticationPrincipal Jwt jwt,
                                    @PathVariable UUID id,
                                    @Valid @RequestBody StageRequest request) {
        return service.move(CurrentUser.id(jwt), id, request.stage());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.id(jwt), id);
    }

    @PostMapping("/{id}/interviews")
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationResponse addInterview(@AuthenticationPrincipal Jwt jwt,
                                            @PathVariable UUID id,
                                            @Valid @RequestBody InterviewRequest request) {
        return service.addInterview(CurrentUser.id(jwt), id, request);
    }

    @PutMapping("/{id}/interviews/{interviewId}")
    public ApplicationResponse updateInterview(@AuthenticationPrincipal Jwt jwt,
                                               @PathVariable UUID id,
                                               @PathVariable UUID interviewId,
                                               @Valid @RequestBody InterviewRequest request) {
        return service.updateInterview(CurrentUser.id(jwt), id, interviewId, request);
    }

    @DeleteMapping("/{id}/interviews/{interviewId}")
    public ApplicationResponse deleteInterview(@AuthenticationPrincipal Jwt jwt,
                                               @PathVariable UUID id,
                                               @PathVariable UUID interviewId) {
        return service.deleteInterview(CurrentUser.id(jwt), id, interviewId);
    }

    @PostMapping("/import")
    public ImportSummary importApplications(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody @Size(max = 1000) List<ApplicationRequest> requests
    ) {
        return service.importApplications(CurrentUser.id(jwt), requests);
    }

    @GetMapping("/export")
    public List<ApplicationResponse> export(@AuthenticationPrincipal Jwt jwt) {
        return service.list(CurrentUser.id(jwt));
    }

    @GetMapping("/follow-ups/due")
    public List<ApplicationResponse> dueFollowUps(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return service.dueFollowUps(CurrentUser.id(jwt), date == null ? LocalDate.now() : date);
    }
}
