package dev.jobtrackr.application;

import dev.jobtrackr.application.ApplicationModels.ApplicationRequest;
import dev.jobtrackr.application.ApplicationModels.ApplicationResponse;
import dev.jobtrackr.application.ApplicationModels.ImportSummary;
import dev.jobtrackr.application.ApplicationModels.InterviewRequest;
import dev.jobtrackr.domain.ApplicationStatus;
import dev.jobtrackr.domain.RecruitmentStage;
import dev.jobtrackr.interview.InterviewEntity;
import dev.jobtrackr.interview.InterviewRepository;
import dev.jobtrackr.user.UserAccountEntity;
import dev.jobtrackr.user.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ApplicationService {

    private final JobApplicationRepository applications;
    private final InterviewRepository interviews;
    private final UserAccountRepository users;

    public ApplicationService(JobApplicationRepository applications,
                              InterviewRepository interviews,
                              UserAccountRepository users) {
        this.applications = applications;
        this.interviews = interviews;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> list(UUID userId) {
        return applications.findAllByOwner_IdOrderByApplicationDateDesc(userId)
            .stream()
            .map(ApplicationResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public ApplicationResponse get(UUID userId, UUID applicationId) {
        return ApplicationResponse.from(requireOwned(userId, applicationId));
    }

    @Transactional
    public ApplicationResponse create(UUID userId, ApplicationRequest request) {
        return ApplicationResponse.from(createEntity(userId, request));
    }

    @Transactional
    public ApplicationResponse update(UUID userId, UUID applicationId, ApplicationRequest request) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        apply(application, request, Instant.now());
        return ApplicationResponse.from(application);
    }

    @Transactional
    public ApplicationResponse move(UUID userId, UUID applicationId, RecruitmentStage stage) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        application.moveTo(stage, Instant.now());
        return ApplicationResponse.from(application);
    }

    @Transactional
    public void delete(UUID userId, UUID applicationId) {
        applications.delete(requireOwned(userId, applicationId));
    }

    @Transactional
    public ApplicationResponse addInterview(UUID userId, UUID applicationId, InterviewRequest request) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        InterviewEntity interview = new InterviewEntity(UUID.randomUUID(), application);
        interview.update(request.date(), request.type(), request.notes(), request.reminderSet());
        application.addInterview(interview, Instant.now());
        return ApplicationResponse.from(application);
    }

    @Transactional
    public ApplicationResponse updateInterview(UUID userId,
                                               UUID applicationId,
                                               UUID interviewId,
                                               InterviewRequest request) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        InterviewEntity interview = interviews.findByIdAndApplication_IdAndApplication_Owner_Id(interviewId, applicationId, userId)
            .orElseThrow(ResourceNotFoundException::new);
        interview.update(request.date(), request.type(), request.notes(), request.reminderSet());
        application.touch(Instant.now());
        return ApplicationResponse.from(application);
    }

    @Transactional
    public ApplicationResponse deleteInterview(UUID userId, UUID applicationId, UUID interviewId) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        InterviewEntity interview = interviews.findByIdAndApplication_IdAndApplication_Owner_Id(interviewId, applicationId, userId)
            .orElseThrow(ResourceNotFoundException::new);
        application.getInterviews().remove(interview);
        application.touch(Instant.now());
        return ApplicationResponse.from(application);
    }

    @Transactional
    public ImportSummary importApplications(UUID userId, List<ApplicationRequest> requests) {
        int imported = 0;
        int skipped = 0;
        for (ApplicationRequest request : requests) {
            if (isDuplicate(userId, request)) {
                skipped++;
                continue;
            }
            createEntity(userId, request);
            imported++;
        }
        return new ImportSummary(imported, skipped);
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> dueFollowUps(UUID userId, LocalDate date) {
        return applications.findAllByOwner_IdAndFollowUpDateLessThanEqualOrderByFollowUpDateAsc(userId, date)
            .stream()
            .filter(application -> application.getStatus() != ApplicationStatus.ACCEPTE
                && application.getStatus() != ApplicationStatus.REFUSE)
            .map(ApplicationResponse::from)
            .toList();
    }

    private JobApplicationEntity createEntity(UUID userId, ApplicationRequest request) {
        UserAccountEntity user = users.findById(userId).orElseThrow(ResourceNotFoundException::new);
        JobApplicationEntity application = new JobApplicationEntity(UUID.randomUUID(), user);
        Instant now = Instant.now();
        apply(application, request, now);

        for (InterviewRequest interviewRequest : request.interviews() == null ? List.<InterviewRequest>of() : request.interviews()) {
            InterviewEntity interview = new InterviewEntity(UUID.randomUUID(), application);
            interview.update(
                interviewRequest.date(),
                interviewRequest.type(),
                interviewRequest.notes(),
                interviewRequest.reminderSet()
            );
            application.addInterview(interview, now);
        }

        return applications.save(application);
    }

    private static void apply(JobApplicationEntity application, ApplicationRequest request, Instant now) {
        application.update(
            request.company(),
            request.position(),
            request.applicationDate(),
            request.status(),
            request.notes(),
            request.responseDate(),
            request.offerUrl(),
            request.contractType(),
            request.salaryTarget(),
            request.salaryPeriod(),
            request.followUpDate(),
            request.recruiterName(),
            request.recruiterEmail(),
            request.recruiterPhone(),
            request.stage(),
            request.priority(),
            now
        );
    }

    private boolean isDuplicate(UUID userId, ApplicationRequest request) {
        if (request.offerUrl() != null && !request.offerUrl().isBlank()
            && applications.existsByOwner_IdAndOfferUrlIgnoreCase(userId, request.offerUrl().trim())) {
            return true;
        }
        return applications.existsByOwner_IdAndCompanyIgnoreCaseAndPositionIgnoreCaseAndApplicationDate(
            userId,
            request.company().trim(),
            request.position().trim(),
            request.applicationDate()
        );
    }

    private JobApplicationEntity requireOwned(UUID userId, UUID applicationId) {
        return applications.findByIdAndOwner_Id(applicationId, userId)
            .orElseThrow(ResourceNotFoundException::new);
    }

    public static class ResourceNotFoundException extends RuntimeException {
    }
}
