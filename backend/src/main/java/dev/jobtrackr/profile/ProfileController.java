package dev.jobtrackr.profile;

import dev.jobtrackr.profile.dto.ProfileRequest;
import dev.jobtrackr.profile.dto.ProfileResponse;
import dev.jobtrackr.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ProfileResponse get(@AuthenticationPrincipal Jwt jwt) {
        return profileService.get(CurrentUser.id(jwt));
    }

    @PutMapping
    public ProfileResponse update(@AuthenticationPrincipal Jwt jwt,
                                  @Valid @RequestBody ProfileRequest request) {
        return profileService.update(CurrentUser.id(jwt), request);
    }
}
