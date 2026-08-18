package dev.jobtrackr.profile;

import dev.jobtrackr.common.exception.ResourceNotFoundException;
import dev.jobtrackr.profile.dto.ProfileRequest;
import dev.jobtrackr.profile.dto.ProfileResponse;
import dev.jobtrackr.identity.UserAccountEntity;
import dev.jobtrackr.identity.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ProfileService {

    private static final int MAX_LIST_VALUES = 30;

    private final UserAccountRepository users;
    private final UserProfileRepository profiles;

    public ProfileService(UserAccountRepository users, UserProfileRepository profiles) {
        this.users = users;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get(UUID userId) {
        UserAccountEntity user = requireUser(userId);
        UserProfileEntity profile = profiles.findById(userId)
            .orElseGet(() -> new UserProfileEntity(userId, Instant.now()));
        return toResponse(user, profile);
    }

    @Transactional
    public ProfileResponse update(UUID userId, ProfileRequest request) {
        UserAccountEntity user = requireUser(userId);
        Instant now = Instant.now();
        user.updateDisplayName(request.name().trim(), now);

        UserProfileEntity profile = profiles.findById(userId)
            .orElseGet(() -> new UserProfileEntity(userId, now));
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
        return toResponse(user, profile);
    }

    private UserAccountEntity requireUser(UUID userId) {
        return users.findById(userId).orElseThrow(ResourceNotFoundException::new);
    }

    private static List<String> sanitize(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
            .filter(value -> value != null && !value.isBlank())
            .map(String::trim)
            .distinct()
            .limit(MAX_LIST_VALUES)
            .toList();
    }

    private static ProfileResponse toResponse(UserAccountEntity user, UserProfileEntity profile) {
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
