package dev.jobtrackr.interview;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InterviewRepository extends JpaRepository<InterviewEntity, UUID> {

    Optional<InterviewEntity> findByIdAndApplication_IdAndApplication_Owner_Id(
        UUID id, UUID applicationId, UUID ownerId);
}
