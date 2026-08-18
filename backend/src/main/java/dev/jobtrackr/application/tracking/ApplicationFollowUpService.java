package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.JobApplicationRepository;
import dev.jobtrackr.application.tracking.dto.FollowUpResponse;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
class ApplicationFollowUpService {
    private static final List<FollowUpStatus> OPEN_STATUSES = List.of(
        FollowUpStatus.PLANNED,
        FollowUpStatus.DUE,
        FollowUpStatus.OVERDUE
    );

    private final JobApplicationRepository applications;
    private final FollowUpRepository followUps;
    private final ApplicationActivityService activity;

    ApplicationFollowUpService(
        JobApplicationRepository applications,
        FollowUpRepository followUps,
        ApplicationActivityService activity
    ) {
        this.applications = applications;
        this.followUps = followUps;
        this.activity = activity;
    }

    List<FollowUpEntity> findAll(UUID applicationId) {
        return followUps.findAllByApplication_IdOrderByScheduledForDesc(applicationId);
    }

    List<FollowUpResponse> responses(UUID applicationId, LocalDate today) {
        return findAll(applicationId).stream()
            .map(item -> toResponse(item, today))
            .toList();
    }

    FollowUpResponse schedule(JobApplicationEntity application, LocalDate date) {
        Instant now = Instant.now();
        FollowUpEntity followUp = findOpen(application.getId())
            .map(existing -> {
                existing.snooze(date, now);
                return existing;
            })
            .orElseGet(() -> new FollowUpEntity(UUID.randomUUID(), application, date, now));

        application.scheduleFollowUp(date, now);
        applications.save(application);
        followUps.save(followUp);
        activity.record(application, ApplicationEventType.FOLLOW_UP_SCHEDULED, "Relance planifiée", "Prévue le " + date, now);
        return toResponse(followUp, LocalDate.now());
    }

    FollowUpResponse completeCurrent(JobApplicationEntity application) {
        FollowUpEntity followUp = findOpen(application.getId()).orElseThrow(ResourceNotFoundException::new);
        return complete(application, followUp);
    }

    FollowUpResponse complete(JobApplicationEntity application, UUID followUpId) {
        FollowUpEntity followUp = followUps.findById(followUpId)
            .filter(item -> item.getApplicationId().equals(application.getId()))
            .orElseThrow(ResourceNotFoundException::new);
        return complete(application, followUp);
    }

    FollowUpResponse snooze(JobApplicationEntity application, UUID followUpId, LocalDate date) {
        FollowUpEntity followUp = followUps.findById(followUpId)
            .filter(item -> item.getApplicationId().equals(application.getId()))
            .orElseThrow(ResourceNotFoundException::new);
        Instant now = Instant.now();

        followUp.snooze(date, now);
        application.scheduleFollowUp(date, now);
        applications.save(application);
        activity.record(
            application,
            ApplicationEventType.FOLLOW_UP_SNOOZED,
            "Relance reportée",
            "Nouvelle date : " + date,
            now
        );
        return toResponse(followUp, LocalDate.now());
    }

    void syncLegacy(JobApplicationEntity application, LocalDate previousDate, Instant now) {
        if (Objects.equals(previousDate, application.getFollowUpDate())) {
            return;
        }

        Optional<FollowUpEntity> current = findOpen(application.getId());
        if (application.getFollowUpDate() == null) {
            current.ifPresent(item -> item.cancel(now));
            return;
        }

        FollowUpEntity item = current.orElseGet(() ->
            new FollowUpEntity(UUID.randomUUID(), application, application.getFollowUpDate(), now)
        );
        if (current.isPresent()) {
            item.snooze(application.getFollowUpDate(), now);
        }
        followUps.save(item);
        activity.record(
            application,
            ApplicationEventType.FOLLOW_UP_SCHEDULED,
            "Relance planifiée",
            "Prévue le " + application.getFollowUpDate(),
            now
        );
    }

    FollowUpResponse toResponse(FollowUpEntity followUp, LocalDate today) {
        return new FollowUpResponse(
            followUp.getId(),
            followUp.getScheduledFor(),
            followUp.effectiveStatus(today),
            followUp.getCompletedAt(),
            followUp.getCreatedAt(),
            followUp.getUpdatedAt()
        );
    }

    private FollowUpResponse complete(JobApplicationEntity application, FollowUpEntity followUp) {
        Instant now = Instant.now();
        followUp.complete(now);
        application.clearFollowUp(now);
        applications.save(application);
        activity.record(
            application,
            ApplicationEventType.FOLLOW_UP_COMPLETED,
            "Relance effectuée",
            "Action marquée comme terminée",
            now
        );
        return toResponse(followUp, LocalDate.now());
    }

    private Optional<FollowUpEntity> findOpen(UUID applicationId) {
        return followUps.findFirstByApplication_IdAndStatusInOrderByScheduledForDesc(applicationId, OPEN_STATUSES);
    }
}
