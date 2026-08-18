package dev.jobtrackr.jobimport.dto;

import dev.jobtrackr.application.domain.ContractType;

import java.time.LocalDate;
import java.util.List;

public record JobImportPreview(
    String sourceUrl,
    String canonicalUrl,
    String company,
    String position,
    String location,
    String description,
    ContractType contractType,
    String employmentType,
    String salary,
    LocalDate datePosted,
    String extractionSource,
    String confidence,
    List<String> warnings
) {
}
