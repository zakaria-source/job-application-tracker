package dev.jobtrackr.workspace;

import dev.jobtrackr.application.dto.ApplicationSummaryResponse;
import dev.jobtrackr.profile.dto.ProfileResponse;

import java.util.List;

public record WorkspaceBootstrapResponse(
    ProfileResponse profile,
    List<ApplicationSummaryResponse> applications
) {
}
