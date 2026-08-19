package dev.jobtrackr.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
class AuthSessionRevocationService {
    private final AuthSessionRepository sessions;

    AuthSessionRevocationService(AuthSessionRepository sessions) {
        this.sessions = sessions;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void revoke(UUID sessionId, Instant now) {
        sessions.findById(sessionId).ifPresent(session -> {
            session.revoke(now);
            sessions.saveAndFlush(session);
        });
    }
}
