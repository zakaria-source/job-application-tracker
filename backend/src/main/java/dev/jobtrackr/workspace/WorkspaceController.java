package dev.jobtrackr.workspace;

import dev.jobtrackr.application.ApplicationService;
import dev.jobtrackr.application.dto.ApplicationSummaryResponse;
import dev.jobtrackr.profile.ProfileService;
import dev.jobtrackr.profile.dto.ProfileResponse;
import dev.jobtrackr.security.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/workspace")
public class WorkspaceController {
    private final ProfileService profiles;
    private final ApplicationService applications;

    public WorkspaceController(ProfileService profiles, ApplicationService applications) {
        this.profiles = profiles;
        this.applications = applications;
    }

    @GetMapping
    public WorkspaceBootstrapResponse bootstrap(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = CurrentUser.id(jwt);
        return new WorkspaceBootstrapResponse(
            profiles.get(userId),
            applications.list(userId)
        );
    }
}

record WorkspaceBootstrapResponse(
    ProfileResponse profile,
    List<ApplicationSummaryResponse> applications
) {
}
