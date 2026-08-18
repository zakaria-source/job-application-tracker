package dev.jobtrackr.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 10, max = 100) String password,
    @NotBlank @Size(max = 120) String displayName
) {
}
