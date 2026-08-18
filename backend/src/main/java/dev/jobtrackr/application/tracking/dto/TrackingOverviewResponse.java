package dev.jobtrackr.application.tracking.dto;

import java.util.List;

public record TrackingOverviewResponse(
    List<ApplicationEventResponse> activity,
    List<FollowUpResponse> followUps,
    ApplicationHealthResponse health,
    List<InterviewDebriefResponse> debriefs
) {
}
