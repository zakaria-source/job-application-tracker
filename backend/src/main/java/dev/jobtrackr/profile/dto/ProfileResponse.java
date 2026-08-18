package dev.jobtrackr.profile.dto;

import java.util.List;

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
}
