package dev.jobtrackr.application.tracking;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface InterviewDebriefRepository extends JpaRepository<InterviewDebriefEntity, UUID> {
    Optional<InterviewDebriefEntity> findByInterview_Id(UUID interviewId);
    List<InterviewDebriefEntity> findAllByInterview_Application_Id(UUID applicationId);
}
