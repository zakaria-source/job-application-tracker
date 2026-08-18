package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.tracking.dto.ApplicationEventResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
class ApplicationActivityService {
    static final int DEFAULT_LIMIT = 50;
    static final int MAX_LIMIT = 100;

    private final ApplicationEventRepository events;

    ApplicationActivityService(ApplicationEventRepository events) {
        this.events = events;
    }

    List<ApplicationEventResponse> recent(UUID applicationId, int requestedLimit) {
        int limit = Math.max(1, Math.min(MAX_LIMIT, requestedLimit));
        return events.findByApplication_IdOrderByCreatedAtDesc(applicationId, PageRequest.of(0, limit))
            .stream()
            .map(this::toResponse)
            .toList();
    }

    void recordCreated(JobApplicationEntity application, Instant now) {
        record(
            application,
            ApplicationEventType.APPLICATION_CREATED,
            "Candidature créée",
            application.getCompany() + " · " + application.getPosition(),
            now
        );
    }

    void recordUpdated(JobApplicationEntity application, Instant now) {
        record(
            application,
            ApplicationEventType.APPLICATION_UPDATED,
            "Candidature mise à jour",
            "Étape actuelle : " + application.getStage(),
            now
        );
    }

    void recordStageChanged(JobApplicationEntity application, RecruitmentStage previous, Instant now) {
        if (previous != application.getStage()) {
            record(
                application,
                ApplicationEventType.STAGE_CHANGED,
                "Étape modifiée",
                previous + " → " + application.getStage(),
                now
            );
        }
    }

    void recordInterviewsUpdated(JobApplicationEntity application, Instant now) {
        record(
            application,
            ApplicationEventType.INTERVIEWS_UPDATED,
            "Entretiens mis à jour",
            application.getInterviews().size() + " rendez-vous",
            now
        );
    }

    void record(
        JobApplicationEntity application,
        ApplicationEventType type,
        String title,
        String details,
        Instant now
    ) {
        events.save(new ApplicationEventEntity(UUID.randomUUID(), application, type, title, details, now));
    }

    private ApplicationEventResponse toResponse(ApplicationEventEntity event) {
        return new ApplicationEventResponse(
            event.getId(),
            event.getType(),
            event.getTitle(),
            event.getDetails(),
            event.getCreatedAt()
        );
    }
}
