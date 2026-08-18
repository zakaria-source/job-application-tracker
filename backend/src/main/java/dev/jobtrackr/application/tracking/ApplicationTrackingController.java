package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.tracking.dto.*;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}")
public class ApplicationTrackingController {
    private final ApplicationTrackingService tracking;
    public ApplicationTrackingController(ApplicationTrackingService tracking) { this.tracking = tracking; }

    @GetMapping("/activity") public List<ApplicationEventResponse> activity(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId) { return tracking.events(CurrentUser.id(jwt), applicationId); }
    @GetMapping("/follow-ups") public List<FollowUpResponse> followUps(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId) { return tracking.followUps(CurrentUser.id(jwt), applicationId); }
    @PostMapping("/follow-ups") public FollowUpResponse schedule(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId, @Valid @RequestBody FollowUpRequest request) { return tracking.schedule(CurrentUser.id(jwt), applicationId, request.scheduledFor()); }
    @PatchMapping("/follow-ups/{followUpId}/complete") public FollowUpResponse complete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId, @PathVariable UUID followUpId) { return tracking.complete(CurrentUser.id(jwt), applicationId, followUpId); }
    @PatchMapping("/follow-ups/{followUpId}/snooze") public FollowUpResponse snooze(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId, @PathVariable UUID followUpId, @Valid @RequestBody FollowUpRequest request) { return tracking.snooze(CurrentUser.id(jwt), applicationId, followUpId, request.scheduledFor()); }
    @GetMapping("/debriefs") public List<InterviewDebriefResponse> debriefs(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId) { return tracking.debriefs(CurrentUser.id(jwt), applicationId); }
    @PutMapping("/interviews/{interviewId}/debrief") public InterviewDebriefResponse debrief(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId, @PathVariable UUID interviewId, @Valid @RequestBody InterviewDebriefRequest request) { return tracking.saveDebrief(CurrentUser.id(jwt), applicationId, interviewId, request); }
    @GetMapping("/health") public ApplicationHealthResponse health(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID applicationId) { return tracking.health(CurrentUser.id(jwt), applicationId); }
}
