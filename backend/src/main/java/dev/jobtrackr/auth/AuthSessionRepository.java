package dev.jobtrackr.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

interface AuthSessionRepository extends JpaRepository<AuthSessionEntity, UUID> {
}
