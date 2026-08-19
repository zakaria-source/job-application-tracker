package dev.jobtrackr.mailtracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.JobApplicationRepository;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.tracking.ApplicationTrackingService;
import dev.jobtrackr.mailtracking.dto.EmailAnalysisRequest;
import dev.jobtrackr.mailtracking.dto.EmailApplyRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailTrackingServiceAutomationTest {

    @Test
    void exposesDetectedStageWhenNoApplicationExistsYet() {
        JobApplicationRepository applications = mock(JobApplicationRepository.class);
        ApplicationTrackingService tracking = mock(ApplicationTrackingService.class);
        when(applications.findAllByOwner_Id(any())).thenReturn(List.of());

        EmailTrackingService service = new EmailTrackingService(
            applications,
            new EmailSignalClassifier(),
            tracking
        );

        var analysis = service.analyze(
            UUID.randomUUID(),
            new EmailAnalysisRequest(
                "Technical interview - next step",
                "Recruiting <jobs@example.com>",
                "We would like to schedule a technical interview with you."
            )
        );

        assertEquals(RecruitmentStage.ENTRETIEN_TECHNIQUE, analysis.suggestedStage());
    }

    @Test
    void automatedApplyDoesNotRegressExistingStage() {
        JobApplicationRepository applications = mock(JobApplicationRepository.class);
        ApplicationTrackingService tracking = mock(ApplicationTrackingService.class);
        JobApplicationEntity application = mock(JobApplicationEntity.class);
        UUID userId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();

        when(applications.findByIdAndOwner_Id(applicationId, userId)).thenReturn(Optional.of(application));
        when(application.getStage()).thenReturn(RecruitmentStage.ENTRETIEN_TECHNIQUE);
        when(application.getId()).thenReturn(applicationId);

        EmailTrackingService service = new EmailTrackingService(
            applications,
            new EmailSignalClassifier(),
            tracking
        );

        service.applyAutomated(
            userId,
            new EmailApplyRequest(
                applicationId,
                RecruitmentStage.SCREENING_RH,
                "Invitation entretien",
                "Screening call"
            )
        );

        verify(application, never()).moveTo(eq(RecruitmentStage.SCREENING_RH), any());
        verify(application).touch(any());
    }
}
