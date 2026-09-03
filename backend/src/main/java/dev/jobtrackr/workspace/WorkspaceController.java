package dev.jobtrackr.workspace;

import dev.jobtrackr.application.ApplicationService;
import dev.jobtrackr.profile.ProfileService;
import dev.jobtrackr.security.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    public WorkspaceBootstrapResponse bootstrap(
        @AuthenticationPrincipal Jwt jwt,
        CsrfToken csrfToken
    ) {
        // Resolving the deferred token makes Spring's SPA CSRF handler issue the
        // XSRF-TOKEN cookie on the same request that hydrates the workspace.
        csrfToken.getToken();
        UUID userId = CurrentUser.id(jwt);
        return new WorkspaceBootstrapResponse(
            profiles.get(userId),
            applications.list(userId)
        );
    }
}
