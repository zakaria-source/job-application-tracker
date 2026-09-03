package dev.jobtrackr.application;

import dev.jobtrackr.application.dto.ApplicationRequest;
import dev.jobtrackr.application.dto.ApplicationResponse;
import dev.jobtrackr.application.dto.ApplicationSummaryResponse;
import dev.jobtrackr.application.dto.ImportSummary;
import dev.jobtrackr.application.dto.StageRequest;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
import org.springframework.web.bind.annotation.RequestHeader;
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
    public List<ApplicationSummaryResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return applicationService.list(CurrentUser.id(jwt));
    }

    @GetMapping("/export")
    public List<ApplicationResponse> export(@AuthenticationPrincipal Jwt jwt) {
        return applicationService.listFull(CurrentUser.id(jwt));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplicationResponse> get(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id
    ) {
        ApplicationResponse response = applicationService.get(CurrentUser.id(jwt), id);
        return ResponseEntity.ok()
            .header(HttpHeaders.ETAG, etag(response.version()))
            .body(response);
    }

    @PostMapping
    public ResponseEntity<ApplicationResponse> create(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody ApplicationRequest request
    ) {
        ApplicationResponse response = applicationService.create(CurrentUser.id(jwt), request);
        return ResponseEntity.status(HttpStatus.CREATED)
            .header(HttpHeaders.ETAG, etag(response.version()))
            .body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApplicationResponse> update(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
        @Valid @RequestBody ApplicationRequest request
    ) {
        ApplicationResponse response = applicationService.update(
            CurrentUser.id(jwt),
            id,
            request,
            parseVersion(ifMatch)
        );
        return ResponseEntity.ok()
            .header(HttpHeaders.ETAG, etag(response.version()))
            .body(response);
    }

    @PatchMapping("/{id}/stage")
    public ResponseEntity<ApplicationResponse> move(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @Valid @RequestBody StageRequest request
    ) {
        ApplicationResponse response = applicationService.move(CurrentUser.id(jwt), id, request.stage());
        return ResponseEntity.ok()
            .header(HttpHeaders.ETAG, etag(response.version()))
            .body(response);
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

    private static Long parseVersion(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return null;
        }
        String value = ifMatch.trim();
        if (value.startsWith("W/")) {
            value = value.substring(2).trim();
        }
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length() - 1);
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw new StaleApplicationException();
        }
    }

    private static String etag(long version) {
        return "\"" + version + "\"";
    }
}
