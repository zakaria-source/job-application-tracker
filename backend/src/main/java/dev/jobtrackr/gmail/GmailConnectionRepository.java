package dev.jobtrackr.gmail;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface GmailConnectionRepository extends JpaRepository<GmailConnectionEntity, UUID> {
    @EntityGraph(attributePaths = "owner")
    Optional<GmailConnectionEntity> findByOwner_Id(UUID userId);

    @EntityGraph(attributePaths = "owner")
    List<GmailConnectionEntity> findAllBySyncEnabledTrue();
}
