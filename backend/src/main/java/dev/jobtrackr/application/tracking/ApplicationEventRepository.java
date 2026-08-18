package dev.jobtrackr.application.tracking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface ApplicationEventRepository extends JpaRepository<ApplicationEventEntity, UUID> {
    List<ApplicationEventEntity> findTop50ByApplication_IdOrderByCreatedAtDesc(UUID applicationId);
}
