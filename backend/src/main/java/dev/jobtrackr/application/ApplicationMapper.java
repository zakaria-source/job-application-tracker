package dev.jobtrackr.application;

import dev.jobtrackr.application.dto.ApplicationResponse;
import dev.jobtrackr.interview.InterviewEntity;
import dev.jobtrackr.interview.dto.InterviewResponse;

public final class ApplicationMapper {

    private ApplicationMapper() {
    }

    public static ApplicationResponse toResponse(JobApplicationEntity application) {
        return new ApplicationResponse(
            application.getId(),
            application.getCompany(),
            application.getPosition(),
            application.getApplicationDate(),
            application.getStatus(),
            application.getNotes(),
            application.getLastUpdated(),
            application.getResponseDate(),
            application.getOfferUrl(),
            application.getContractType(),
            application.getSalaryTarget(),
            application.getSalaryPeriod(),
            application.getFollowUpDate(),
            application.getRecruiterName(),
            application.getRecruiterEmail(),
            application.getRecruiterPhone(),
            application.getStage(),
            application.getPriority(),
            application.getInterviews().stream().map(ApplicationMapper::toInterviewResponse).toList(),
            application.getVersion()
        );
    }

    private static InterviewResponse toInterviewResponse(InterviewEntity interview) {
        return new InterviewResponse(
            interview.getId(),
            interview.getDate(),
            interview.getType(),
            interview.getNotes(),
            interview.isReminderSet()
        );
    }
}
