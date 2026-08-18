package dev.jobtrackr.application.tracking;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface ApplicationEventRepository extends JpaRepository<ApplicationEventEntity, UUID> {
    List<ApplicationEventEntity> findByApplication_IdOrderByCreatedAtDesc(UUID applicationId, Pageable pageable);
}
