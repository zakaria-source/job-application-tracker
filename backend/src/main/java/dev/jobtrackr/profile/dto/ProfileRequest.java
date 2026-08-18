package dev.jobtrackr.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

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
