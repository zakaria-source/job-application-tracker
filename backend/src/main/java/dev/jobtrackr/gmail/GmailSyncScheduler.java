package dev.jobtrackr.gmail;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class GmailSyncScheduler {
    private final GmailSyncService syncService;

    GmailSyncScheduler(GmailSyncService syncService) {
        this.syncService = syncService;
    }

    @Scheduled(
        fixedDelayString = "${jobtrackr.gmail.sync-delay-ms:900000}",
        initialDelayString = "${jobtrackr.gmail.sync-initial-delay-ms:60000}"
    )
    void synchronizeConnectedMailboxes() {
        syncService.syncAllConnected();
    }
}
