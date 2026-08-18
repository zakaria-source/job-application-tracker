package dev.jobtrackr.application.tracking.dto;

import java.util.List;

public record ApplicationHealthResponse(int score, String level, List<String> strengths, List<String> risks) {}
