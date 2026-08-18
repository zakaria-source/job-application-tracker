package dev.jobtrackr.application;

import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.dto.ApplicationRequest;
import dev.jobtrackr.application.dto.ApplicationResponse;
import dev.jobtrackr.application.dto.ImportSummary;
import dev.jobtrackr.application.interview.InterviewEntity;
import dev.jobtrackr.application.interview.dto.InterviewRequest;
import dev.jobtrackr.application.tracking.ApplicationTrackingService;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import dev.jobtrackr.identity.UserAccountEntity;
import dev.jobtrackr.identity.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ApplicationService {
    private static final Logger log = LoggerFactory.getLogger(ApplicationService.class);
    private final JobApplicationRepository applications;
    private final UserAccountRepository users;
    private final ApplicationTrackingService tracking;

    public ApplicationService(JobApplicationRepository applications, UserAccountRepository users, ApplicationTrackingService tracking) {
        this.applications = applications; this.users = users; this.tracking = tracking;
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> list(UUID userId) {
        return applications.findAllByOwner_IdOrderByApplicationDateDesc(userId).stream().map(ApplicationMapper::toResponse).toList();
    }

    @Transactional
    public ApplicationResponse create(UUID userId, ApplicationRequest request) {
        JobApplicationEntity application = createEntity(userId, request, true);
        log.info("application_event action=create userId={} applicationId={} stage={}", userId, application.getId(), application.getStage());
        return ApplicationMapper.toResponse(application);
    }

    @Transactional
    public ApplicationResponse update(UUID userId, UUID applicationId, ApplicationRequest request) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        RecruitmentStage previousStage = application.getStage(); LocalDate previousFollowUp = application.getFollowUpDate();
        int previousInterviewCount = application.getInterviews().size(); Instant now = Instant.now();
        apply(application, request, now); replaceInterviews(application, request.interviews(), now);
        tracking.recordUpdated(application, now);
        if (previousStage != application.getStage()) tracking.recordStageChanged(application, previousStage, now);
        if (previousInterviewCount != application.getInterviews().size()) tracking.recordInterviewsUpdated(application, now);
        tracking.syncLegacyFollowUp(application, previousFollowUp, now);
        log.info("application_event action=update userId={} applicationId={} stage={}", userId, applicationId, application.getStage());
        return ApplicationMapper.toResponse(application);
    }

    @Transactional
    public ApplicationResponse move(UUID userId, UUID applicationId, RecruitmentStage stage) {
        JobApplicationEntity application = requireOwned(userId, applicationId); RecruitmentStage previous = application.getStage(); Instant now = Instant.now();
        application.moveTo(stage, now); tracking.recordStageChanged(application, previous, now);
        log.info("application_event action=move userId={} applicationId={} stage={}", userId, applicationId, stage);
        return ApplicationMapper.toResponse(application);
    }

    @Transactional public void delete(UUID userId, UUID applicationId) { applications.delete(requireOwned(userId, applicationId)); log.info("application_event action=delete userId={} applicationId={}", userId, applicationId); }

    @Transactional
    public ImportSummary importApplications(UUID userId, List<ApplicationRequest> requests) {
        int imported = 0, skipped = 0;
        for (ApplicationRequest request : requests) { if (isDuplicate(userId, request)) skipped++; else { createEntity(userId, request, true); imported++; } }
        log.info("application_event action=import userId={} imported={} skipped={}", userId, imported, skipped); return new ImportSummary(imported, skipped);
    }

    private JobApplicationEntity createEntity(UUID userId, ApplicationRequest request, boolean recordEvent) {
        UserAccountEntity user = users.findById(userId).orElseThrow(ResourceNotFoundException::new);
        JobApplicationEntity application = new JobApplicationEntity(UUID.randomUUID(), user); Instant now = Instant.now();
        apply(application, request, now); replaceInterviews(application, request.interviews(), now); applications.save(application);
        if (recordEvent) { tracking.recordCreated(application, now); tracking.syncLegacyFollowUp(application, null, now); if (!application.getInterviews().isEmpty()) tracking.recordInterviewsUpdated(application, now); }
        return application;
    }

    private static void replaceInterviews(JobApplicationEntity application, List<InterviewRequest> interviewRequests, Instant now) {
        application.getInterviews().clear(); List<InterviewRequest> requests = interviewRequests == null ? List.of() : interviewRequests;
        for (InterviewRequest request : requests) { InterviewEntity interview = new InterviewEntity(UUID.randomUUID(), application); interview.update(request.date(), request.type(), request.notes(), request.reminderSet()); application.addInterview(interview, now); }
    }

    private static void apply(JobApplicationEntity application, ApplicationRequest request, Instant now) {
        application.update(request.company(), request.position(), request.applicationDate(), request.notes(), request.responseDate(), request.offerUrl(), request.contractType(), request.salaryTarget(), request.salaryPeriod(), request.followUpDate(), request.recruiterName(), request.recruiterEmail(), request.recruiterPhone(), request.stage(), request.priority(), now);
    }

    private boolean isDuplicate(UUID userId, ApplicationRequest request) {
        if (request.offerUrl() != null && !request.offerUrl().isBlank() && applications.existsByOwner_IdAndOfferUrlIgnoreCase(userId, request.offerUrl().trim())) return true;
        return applications.existsByOwner_IdAndCompanyIgnoreCaseAndPositionIgnoreCaseAndApplicationDate(userId, request.company().trim(), request.position().trim(), request.applicationDate());
    }
    private JobApplicationEntity requireOwned(UUID userId, UUID applicationId) { return applications.findByIdAndOwner_Id(applicationId, userId).orElseThrow(ResourceNotFoundException::new); }
}
