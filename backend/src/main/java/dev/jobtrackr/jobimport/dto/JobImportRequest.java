package dev.jobtrackr.jobimport.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JobImportRequest(
    @NotBlank @Size(max = 2048) String url
) {
}
