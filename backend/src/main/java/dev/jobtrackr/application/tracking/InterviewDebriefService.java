package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.interview.InterviewEntity;
import dev.jobtrackr.application.tracking.dto.InterviewDebriefRequest;
import dev.jobtrackr.application.tracking.dto.InterviewDebriefResponse;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
class InterviewDebriefService {
    private final InterviewDebriefRepository debriefs;
    private final ApplicationActivityService activity;

    InterviewDebriefService(
        InterviewDebriefRepository debriefs,
        ApplicationActivityService activity
    ) {
        this.debriefs = debriefs;
        this.activity = activity;
    }

    List<InterviewDebriefResponse> findAll(UUID applicationId) {
        return debriefs.findAllByInterview_Application_Id(applicationId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    InterviewDebriefResponse save(
        JobApplicationEntity application,
        UUID interviewId,
        InterviewDebriefRequest request
    ) {
        InterviewEntity interview = application.getInterviews()
            .stream()
            .filter(item -> item.getId().equals(interviewId))
            .findFirst()
            .orElseThrow(ResourceNotFoundException::new);
        InterviewDebriefEntity debrief = debriefs.findByInterview_Id(interviewId)
            .orElseGet(() -> new InterviewDebriefEntity(UUID.randomUUID(), interview));

        Instant now = Instant.now();
        debrief.update(
            request.sentiment(),
            request.questions(),
            request.strengths(),
            request.improvements(),
            request.nextAction(),
            now
        );
        debriefs.save(debrief);
        activity.record(
            application,
            ApplicationEventType.DEBRIEF_SAVED,
            "Débrief d’entretien enregistré",
            interview.getType().toString(),
            now
        );
        return toResponse(debrief);
    }

    private InterviewDebriefResponse toResponse(InterviewDebriefEntity debrief) {
        return new InterviewDebriefResponse(
            debrief.getId(),
            debrief.getInterviewId(),
            debrief.getSentiment(),
            debrief.getQuestions(),
            debrief.getStrengths(),
            debrief.getImprovements(),
            debrief.getNextAction(),
            debrief.getUpdatedAt()
        );
    }
}
