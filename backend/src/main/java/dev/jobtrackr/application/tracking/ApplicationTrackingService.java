package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.JobApplicationRepository;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.tracking.dto.ApplicationEventResponse;
import dev.jobtrackr.application.tracking.dto.ApplicationHealthResponse;
import dev.jobtrackr.application.tracking.dto.FollowUpResponse;
import dev.jobtrackr.application.tracking.dto.InterviewDebriefRequest;
import dev.jobtrackr.application.tracking.dto.InterviewDebriefResponse;
import dev.jobtrackr.application.tracking.dto.TrackingOverviewResponse;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ApplicationTrackingService {
    private final JobApplicationRepository applications;
    private final ApplicationActivityService activity;
    private final ApplicationFollowUpService followUps;
    private final ApplicationHealthService health;
    private final InterviewDebriefService debriefs;

    public ApplicationTrackingService(
        JobApplicationRepository applications,
        ApplicationActivityService activity,
        ApplicationFollowUpService followUps,
        ApplicationHealthService health,
        InterviewDebriefService debriefs
    ) {
        this.applications = applications;
        this.activity = activity;
        this.followUps = followUps;
        this.health = health;
        this.debriefs = debriefs;
    }

    @Transactional(readOnly = true)
    public List<ApplicationEventResponse> events(UUID userId, UUID applicationId, int limit) {
        requireOwned(userId, applicationId);
        return activity.recent(applicationId, limit);
    }

    @Transactional(readOnly = true)
    public List<FollowUpResponse> followUps(UUID userId, UUID applicationId) {
        requireOwned(userId, applicationId);
        return followUps.responses(applicationId, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public TrackingOverviewResponse overview(UUID userId, UUID applicationId) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        Instant now = Instant.now();
        LocalDate today = LocalDate.now();
        List<FollowUpEntity> followUpEntities = followUps.findAll(applicationId);

        return new TrackingOverviewResponse(
            activity.recent(applicationId, ApplicationActivityService.DEFAULT_LIMIT),
            followUpEntities.stream().map(item -> followUps.toResponse(item, today)).toList(),
            health.calculate(application, followUpEntities, today, now),
            debriefs.findAll(applicationId)
        );
    }

    @Transactional
    public FollowUpResponse schedule(UUID userId, UUID applicationId, LocalDate date) {
        return followUps.schedule(requireOwned(userId, applicationId), date);
    }

    @Transactional
    public FollowUpResponse completeCurrent(UUID userId, UUID applicationId) {
        return followUps.completeCurrent(requireOwned(userId, applicationId));
    }

    @Transactional
    public FollowUpResponse complete(UUID userId, UUID applicationId, UUID followUpId) {
        return followUps.complete(requireOwned(userId, applicationId), followUpId);
    }

    @Transactional
    public FollowUpResponse snooze(UUID userId, UUID applicationId, UUID followUpId, LocalDate date) {
        return followUps.snooze(requireOwned(userId, applicationId), followUpId, date);
    }

    @Transactional(readOnly = true)
    public List<InterviewDebriefResponse> debriefs(UUID userId, UUID applicationId) {
        requireOwned(userId, applicationId);
        return debriefs.findAll(applicationId);
    }

    @Transactional
    public InterviewDebriefResponse saveDebrief(
        UUID userId,
        UUID applicationId,
        UUID interviewId,
        InterviewDebriefRequest request
    ) {
        return debriefs.save(requireOwned(userId, applicationId), interviewId, request);
    }

    @Transactional(readOnly = true)
    public ApplicationHealthResponse health(UUID userId, UUID applicationId) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        Instant now = Instant.now();
        LocalDate today = LocalDate.now();
        return health.calculate(application, followUps.findAll(applicationId), today, now);
    }

    public void recordCreated(JobApplicationEntity application, Instant now) {
        activity.recordCreated(application, now);
    }

    public void recordUpdated(JobApplicationEntity application, Instant now) {
        activity.recordUpdated(application, now);
    }

    public void recordStageChanged(JobApplicationEntity application, RecruitmentStage previous, Instant now) {
        activity.recordStageChanged(application, previous, now);
    }

    public void recordInterviewsUpdated(JobApplicationEntity application, Instant now) {
        activity.recordInterviewsUpdated(application, now);
    }

    public void recordEmailSignal(JobApplicationEntity application, String signalType, String subject, Instant now) {
        String cleanSubject = subject == null ? "" : subject.trim().replaceAll("\\s+", " ");
        String shortenedSubject = cleanSubject.length() > 140 ? cleanSubject.substring(0, 137) + "..." : cleanSubject;
        activity.record(
            application,
            ApplicationEventType.EMAIL_SIGNAL_APPLIED,
            "Mail de recrutement analysé",
            signalType + (shortenedSubject.isBlank() ? "" : " · " + shortenedSubject),
            now
        );
    }

    public void syncLegacyFollowUp(JobApplicationEntity application, LocalDate previousDate, Instant now) {
        followUps.syncLegacy(application, previousDate, now);
    }

    private JobApplicationEntity requireOwned(UUID userId, UUID applicationId) {
        return applications.findByIdAndOwner_Id(applicationId, userId)
            .orElseThrow(ResourceNotFoundException::new);
    }
}
