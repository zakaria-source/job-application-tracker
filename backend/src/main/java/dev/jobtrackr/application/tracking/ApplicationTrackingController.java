package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.tracking.dto.ApplicationEventResponse;
import dev.jobtrackr.application.tracking.dto.ApplicationHealthResponse;
import dev.jobtrackr.application.tracking.dto.FollowUpRequest;
import dev.jobtrackr.application.tracking.dto.FollowUpResponse;
import dev.jobtrackr.application.tracking.dto.InterviewDebriefRequest;
import dev.jobtrackr.application.tracking.dto.InterviewDebriefResponse;
import dev.jobtrackr.application.tracking.dto.TrackingOverviewResponse;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}")
@Validated
public class ApplicationTrackingController {
    private final ApplicationTrackingService tracking;

    public ApplicationTrackingController(ApplicationTrackingService tracking) {
        this.tracking = tracking;
    }

    @GetMapping("/tracking-overview")
    public TrackingOverviewResponse overview(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId
    ) {
        return tracking.overview(CurrentUser.id(jwt), applicationId);
    }

    @GetMapping("/activity")
    public List<ApplicationEventResponse> activity(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId,
        @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit
    ) {
        return tracking.events(CurrentUser.id(jwt), applicationId, limit);
    }

    @GetMapping("/follow-ups")
    public List<FollowUpResponse> followUps(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId
    ) {
        return tracking.followUps(CurrentUser.id(jwt), applicationId);
    }

    @PostMapping("/follow-ups")
    public FollowUpResponse schedule(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId,
        @Valid @RequestBody FollowUpRequest request
    ) {
        return tracking.schedule(CurrentUser.id(jwt), applicationId, request.scheduledFor());
    }

    @PatchMapping("/follow-ups/current/complete")
    public FollowUpResponse completeCurrent(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId
    ) {
        return tracking.completeCurrent(CurrentUser.id(jwt), applicationId);
    }

    @PatchMapping("/follow-ups/{followUpId}/complete")
    public FollowUpResponse complete(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId,
        @PathVariable UUID followUpId
    ) {
        return tracking.complete(CurrentUser.id(jwt), applicationId, followUpId);
    }

    @PatchMapping("/follow-ups/{followUpId}/snooze")
    public FollowUpResponse snooze(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId,
        @PathVariable UUID followUpId,
        @Valid @RequestBody FollowUpRequest request
    ) {
        return tracking.snooze(CurrentUser.id(jwt), applicationId, followUpId, request.scheduledFor());
    }

    @GetMapping("/debriefs")
    public List<InterviewDebriefResponse> debriefs(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId
    ) {
        return tracking.debriefs(CurrentUser.id(jwt), applicationId);
    }

    @PutMapping("/interviews/{interviewId}/debrief")
    public InterviewDebriefResponse debrief(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId,
        @PathVariable UUID interviewId,
        @Valid @RequestBody InterviewDebriefRequest request
    ) {
        return tracking.saveDebrief(CurrentUser.id(jwt), applicationId, interviewId, request);
    }

    @GetMapping("/health")
    public ApplicationHealthResponse health(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID applicationId
    ) {
        return tracking.health(CurrentUser.id(jwt), applicationId);
    }
}
