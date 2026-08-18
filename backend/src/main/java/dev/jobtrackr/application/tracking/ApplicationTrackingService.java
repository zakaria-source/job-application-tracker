package dev.jobtrackr.application.tracking;

import dev.jobtrackr.application.JobApplicationEntity;
import dev.jobtrackr.application.JobApplicationRepository;
import dev.jobtrackr.application.domain.RecruitmentStage;
import dev.jobtrackr.application.interview.InterviewEntity;
import dev.jobtrackr.application.tracking.dto.*;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class ApplicationTrackingService {
    private static final List<FollowUpStatus> OPEN_FOLLOW_UPS = List.of(FollowUpStatus.PLANNED, FollowUpStatus.DUE, FollowUpStatus.OVERDUE);
    private final JobApplicationRepository applications;
    private final ApplicationEventRepository events;
    private final FollowUpRepository followUps;
    private final InterviewDebriefRepository debriefs;

    public ApplicationTrackingService(JobApplicationRepository applications, ApplicationEventRepository events, FollowUpRepository followUps, InterviewDebriefRepository debriefs) {
        this.applications = applications; this.events = events; this.followUps = followUps; this.debriefs = debriefs;
    }

    @Transactional(readOnly = true)
    public List<ApplicationEventResponse> events(UUID userId, UUID applicationId) {
        requireOwned(userId, applicationId);
        return events.findAllByApplication_IdOrderByCreatedAtDesc(applicationId).stream().map(this::eventResponse).toList();
    }

    @Transactional
    public List<FollowUpResponse> followUps(UUID userId, UUID applicationId) {
        requireOwned(userId, applicationId);
        Instant now = Instant.now(); LocalDate today = LocalDate.now();
        List<FollowUpEntity> items = followUps.findAllByApplication_IdOrderByScheduledForDesc(applicationId);
        items.forEach(item -> item.refresh(today, now));
        return followUps.saveAll(items).stream().map(this::followUpResponse).toList();
    }

    @Transactional
    public FollowUpResponse schedule(UUID userId, UUID applicationId, LocalDate date) {
        JobApplicationEntity application = requireOwned(userId, applicationId); Instant now = Instant.now();
        FollowUpEntity followUp = findOpen(applicationId)
            .map(existing -> { existing.snooze(date, now); return existing; })
            .orElseGet(() -> new FollowUpEntity(UUID.randomUUID(), application, date, now));
        application.scheduleFollowUp(date, now); applications.save(application); followUps.save(followUp);
        record(application, ApplicationEventType.FOLLOW_UP_SCHEDULED, "Relance planifiée", "Prévue le " + date, now);
        return followUpResponse(followUp);
    }

    @Transactional
    public FollowUpResponse completeCurrent(UUID userId, UUID applicationId) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        FollowUpEntity followUp = findOpen(applicationId).orElseThrow(ResourceNotFoundException::new);
        return complete(application, followUp);
    }

    @Transactional
    public FollowUpResponse complete(UUID userId, UUID applicationId, UUID followUpId) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        FollowUpEntity followUp = followUps.findById(followUpId).filter(item -> item.getApplicationId().equals(applicationId)).orElseThrow(ResourceNotFoundException::new);
        return complete(application, followUp);
    }

    @Transactional
    public FollowUpResponse snooze(UUID userId, UUID applicationId, UUID followUpId, LocalDate date) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        FollowUpEntity followUp = followUps.findById(followUpId).filter(item -> item.getApplicationId().equals(applicationId)).orElseThrow(ResourceNotFoundException::new);
        Instant now = Instant.now(); followUp.snooze(date, now); application.scheduleFollowUp(date, now); applications.save(application);
        record(application, ApplicationEventType.FOLLOW_UP_SNOOZED, "Relance reportée", "Nouvelle date : " + date, now);
        return followUpResponse(followUp);
    }

    @Transactional(readOnly = true)
    public List<InterviewDebriefResponse> debriefs(UUID userId, UUID applicationId) {
        requireOwned(userId, applicationId);
        return debriefs.findAllByInterview_Application_Id(applicationId).stream().map(this::debriefResponse).toList();
    }

    @Transactional
    public InterviewDebriefResponse saveDebrief(UUID userId, UUID applicationId, UUID interviewId, InterviewDebriefRequest request) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        InterviewEntity interview = application.getInterviews().stream().filter(item -> item.getId().equals(interviewId)).findFirst().orElseThrow(ResourceNotFoundException::new);
        InterviewDebriefEntity debrief = debriefs.findByInterview_Id(interviewId).orElseGet(() -> new InterviewDebriefEntity(UUID.randomUUID(), interview));
        Instant now = Instant.now(); debrief.update(request.sentiment(), request.questions(), request.strengths(), request.improvements(), request.nextAction(), now); debriefs.save(debrief);
        record(application, ApplicationEventType.DEBRIEF_SAVED, "Débrief d’entretien enregistré", interview.getType().toString(), now);
        return debriefResponse(debrief);
    }

    @Transactional
    public ApplicationHealthResponse health(UUID userId, UUID applicationId) {
        JobApplicationEntity application = requireOwned(userId, applicationId);
        List<FollowUpEntity> currentFollowUps = followUps.findAllByApplication_IdOrderByScheduledForDesc(applicationId);
        Instant now = Instant.now(); LocalDate today = LocalDate.now(); currentFollowUps.forEach(item -> item.refresh(today, now)); followUps.saveAll(currentFollowUps);
        List<String> strengths = new ArrayList<>(); List<String> risks = new ArrayList<>(); int score = 20;
        long inactiveDays = Math.max(0, Duration.between(application.getLastUpdated(), now).toDays());
        if (inactiveDays <= 7) { score += 20; strengths.add("Activité récente"); } else if (inactiveDays <= 14) { score += 10; } else { risks.add("Aucune activité depuis " + inactiveDays + " jours"); }
        if (application.getRecruiterName() != null || application.getRecruiterEmail() != null) { score += 15; strengths.add("Contact recruteur identifié"); } else risks.add("Aucun contact recruteur");
        if (application.getResponseDate() != null) { score += 15; strengths.add("Réponse reçue"); }
        if (!application.getInterviews().isEmpty()) { score += 15; strengths.add("Entretien enregistré"); }
        if (application.getStage() != RecruitmentStage.CANDIDATURE && application.getStage() != RecruitmentStage.CLOTURE) { score += 10; strengths.add("Pipeline en progression"); }
        Optional<FollowUpEntity> open = currentFollowUps.stream().filter(item -> OPEN_FOLLOW_UPS.contains(item.getStatus())).findFirst();
        if (open.isPresent()) { score += 15; strengths.add("Prochaine relance planifiée"); if (open.get().getStatus() == FollowUpStatus.OVERDUE) { score -= 20; risks.add("Relance en retard"); } }
        else if (application.getStatus().name().equals("ENVOYE")) risks.add("Aucune prochaine action planifiée");
        score = Math.max(0, Math.min(100, score));
        String level = score >= 75 ? "HEALTHY" : score >= 50 ? "WATCH" : "AT_RISK";
        return new ApplicationHealthResponse(score, level, strengths, risks);
    }

    public void recordCreated(JobApplicationEntity application, Instant now) { record(application, ApplicationEventType.APPLICATION_CREATED, "Candidature créée", application.getCompany() + " · " + application.getPosition(), now); }
    public void recordUpdated(JobApplicationEntity application, Instant now) { record(application, ApplicationEventType.APPLICATION_UPDATED, "Candidature mise à jour", "Étape actuelle : " + application.getStage(), now); }
    public void recordStageChanged(JobApplicationEntity application, RecruitmentStage previous, Instant now) { if (previous != application.getStage()) record(application, ApplicationEventType.STAGE_CHANGED, "Étape modifiée", previous + " → " + application.getStage(), now); }
    public void recordInterviewsUpdated(JobApplicationEntity application, Instant now) { record(application, ApplicationEventType.INTERVIEWS_UPDATED, "Entretiens mis à jour", application.getInterviews().size() + " rendez-vous", now); }
    public void syncLegacyFollowUp(JobApplicationEntity application, LocalDate previousDate, Instant now) {
        if (Objects.equals(previousDate, application.getFollowUpDate())) return;
        Optional<FollowUpEntity> current = findOpen(application.getId());
        if (application.getFollowUpDate() == null) { current.ifPresent(item -> item.cancel(now)); return; }
        FollowUpEntity item = current.orElseGet(() -> new FollowUpEntity(UUID.randomUUID(), application, application.getFollowUpDate(), now));
        if (current.isPresent()) item.snooze(application.getFollowUpDate(), now); followUps.save(item);
        record(application, ApplicationEventType.FOLLOW_UP_SCHEDULED, "Relance planifiée", "Prévue le " + application.getFollowUpDate(), now);
    }
    private FollowUpResponse complete(JobApplicationEntity application, FollowUpEntity followUp) {
        Instant now = Instant.now(); followUp.complete(now); application.clearFollowUp(now); applications.save(application);
        record(application, ApplicationEventType.FOLLOW_UP_COMPLETED, "Relance effectuée", "Action marquée comme terminée", now);
        return followUpResponse(followUp);
    }
    private Optional<FollowUpEntity> findOpen(UUID applicationId) { return followUps.findFirstByApplication_IdAndStatusInOrderByScheduledForDesc(applicationId, OPEN_FOLLOW_UPS); }
    private void record(JobApplicationEntity application, ApplicationEventType type, String title, String details, Instant now) { events.save(new ApplicationEventEntity(UUID.randomUUID(), application, type, title, details, now)); }
    private JobApplicationEntity requireOwned(UUID userId, UUID applicationId) { return applications.findByIdAndOwner_Id(applicationId, userId).orElseThrow(ResourceNotFoundException::new); }
    private ApplicationEventResponse eventResponse(ApplicationEventEntity e) { return new ApplicationEventResponse(e.getId(), e.getType(), e.getTitle(), e.getDetails(), e.getCreatedAt()); }
    private FollowUpResponse followUpResponse(FollowUpEntity f) { return new FollowUpResponse(f.getId(), f.getScheduledFor(), f.getStatus(), f.getCompletedAt(), f.getCreatedAt(), f.getUpdatedAt()); }
    private InterviewDebriefResponse debriefResponse(InterviewDebriefEntity d) { return new InterviewDebriefResponse(d.getId(), d.getInterviewId(), d.getSentiment(), d.getQuestions(), d.getStrengths(), d.getImprovements(), d.getNextAction(), d.getUpdatedAt()); }
}
