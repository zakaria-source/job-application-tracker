package dev.jobtrackr.application.tracking;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface FollowUpRepository extends JpaRepository<FollowUpEntity, UUID> {
    List<FollowUpEntity> findAllByApplication_IdOrderByScheduledForDesc(UUID applicationId);
    Optional<FollowUpEntity> findFirstByApplication_IdAndStatusInOrderByScheduledForDesc(UUID applicationId, List<FollowUpStatus> statuses);
}
