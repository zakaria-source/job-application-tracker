package dev.jobtrackr.profile;

import dev.jobtrackr.security.CurrentUser;
import dev.jobtrackr.user.UserAccountEntity;
import dev.jobtrackr.user.UserAccountRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    private final UserAccountRepository users;
    private final UserProfileRepository profiles;

    public ProfileController(UserAccountRepository users, UserProfileRepository profiles) {
        this.users = users;
        this.profiles = profiles;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ProfileResponse get(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = CurrentUser.id(jwt);
        UserAccountEntity user = users.findById(userId).orElseThrow();
        UserProfileEntity profile = profiles.findById(userId).orElseGet(() -> new UserProfileEntity(userId, Instant.now()));
        return ProfileResponse.from(user, profile);
    }

    @PutMapping
    @Transactional
    public ProfileResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileRequest request) {
        UUID userId = CurrentUser.id(jwt);
        UserAccountEntity user = users.findById(userId).orElseThrow();
        Instant now = Instant.now();
        user.updateDisplayName(request.name().trim(), now);

        UserProfileEntity profile = profiles.findById(userId).orElseGet(() -> new UserProfileEntity(userId, now));
        profile.update(
            request.headline(),
            request.experienceLabel(),
            request.location(),
            request.summary(),
            sanitize(request.coreSkills()),
            sanitize(request.certifications()),
            request.education(),
            request.targetCompensation(),
            now
        );
        profiles.save(profile);
        return ProfileResponse.from(user, profile);
    }

    private static List<String> sanitize(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
            .filter(value -> value != null && !value.isBlank())
            .map(String::trim)
            .distinct()
            .limit(30)
            .toList();
    }

    public record ProfileRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 180) String headline,
        @Size(max = 120) String experienceLabel,
        @Size(max = 180) String location,
        @Size(max = 4000) String summary,
        List<@Size(max = 120) String> coreSkills,
        List<@Size(max = 180) String> certifications,
        @Size(max = 240) String education,
        @Size(max = 120) String targetCompensation
    ) {
    }

    public record ProfileResponse(
        String name,
        String headline,
        String experienceLabel,
        String location,
        String summary,
        List<String> coreSkills,
        List<String> certifications,
        String education,
        String targetCompensation
    ) {
        static ProfileResponse from(UserAccountEntity user, UserProfileEntity profile) {
            return new ProfileResponse(
                user.getDisplayName(),
                profile.getHeadline(),
                profile.getExperienceLabel(),
                profile.getLocation(),
                profile.getSummary(),
                profile.getCoreSkills(),
                profile.getCertifications(),
                profile.getEducation(),
                profile.getTargetCompensation()
            );
        }
    }
}
