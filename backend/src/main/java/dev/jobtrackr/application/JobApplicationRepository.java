package dev.jobtrackr.application;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobApplicationRepository extends JpaRepository<JobApplicationEntity, UUID> {

    @EntityGraph(attributePaths = "interviews")
    List<JobApplicationEntity> findAllByOwner_IdOrderByApplicationDateDesc(UUID ownerId);

    List<JobApplicationEntity> findAllByOwner_Id(UUID ownerId);

    @EntityGraph(attributePaths = "interviews")
    Optional<JobApplicationEntity> findByIdAndOwner_Id(UUID id, UUID ownerId);
}
