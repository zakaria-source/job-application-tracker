package dev.jobtrackr.mailtracking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmailAnalysisRequest(
    @NotBlank @Size(max = 300) String subject,
    @Size(max = 320) String sender,
    @NotBlank @Size(max = 20000) String body
) {}
