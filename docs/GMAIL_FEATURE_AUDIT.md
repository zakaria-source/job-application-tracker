# Gmail feature audit

Date: 2026-08-19

## Scope

This audit covers the JobTrackr Gmail integration end to end:

- Google OAuth and token persistence
- Gmail full and incremental synchronization
- MIME/body extraction
- recruitment-signal classification
- application matching
- automatic application discovery/creation
- stage evolution
- processed-message deduplication
- user-facing synchronization feedback

## High-impact findings fixed in this audit

### 1. Full scans could inspect non-Inbox mail

The initial/recovery scan used a Gmail search query without an Inbox label restriction. That made the full scan less strict than incremental history synchronization and could allow sent or otherwise irrelevant mailbox messages into the recruitment pipeline.

**Fix:** full scans now explicitly require the `INBOX` label while preserving the existing lookback and category filters.

### 2. Full scans could reconstruct a recruitment process backwards

Gmail message listing is not used as a chronological event stream, while recruitment stages are inherently chronological. Processing a rejection/offer before an older acknowledgement/interview can produce incorrect reconstructed state.

**Fix:** fetched messages are now sorted by Gmail `internalDate` from oldest to newest before classification and application updates.

### 3. Gmail thread continuity was not used

A later message in the same Gmail thread could fail company/position matching if the sender changed, an ATS relay was used, or the message was short.

**Fix:** once a message in a Gmail thread is attached to an application, subsequent messages in that same thread reuse that application as a high-confidence association. This also allows otherwise unclassified messages in a known recruitment thread to remain visible in application activity.

### 4. A recruiter person's name could become the company name

For a sender such as `Jane Doe <jane@mirakl.com>`, the previous extraction order could treat `Jane Doe` as the employer before consulting the corporate domain.

**Fix:** sender display names are trusted as employers only when they look organizational (Careers, Recruiting, Talent, Hiring, Team, etc.) or are corroborated by message content. Otherwise recruitment context and corporate domain are preferred. Common `hq` domain suffixes are normalized (for example `datadoghq.com` -> `Datadog`).

### 5. Discovery had no independent duplicate guard

Creation was triggered when the main matcher returned no candidates. A matcher miss could therefore create a duplicate even when the recruiter email or exact company/position already existed.

**Fix:** discovery now performs a second deduplication pass before creation using recruiter email and normalized company/position. A single placeholder application (`Poste à identifier`) for the same company is reused rather than duplicated.

### 6. New applications could lose the detected recruitment stage

The email-analysis service intentionally suppressed a suggested stage when no application match existed. Automatic discovery therefore could not reliably initialize a newly discovered application at an interview/offer/rejection stage.

**Fix:** the classifier's stage is now retained when no application exists yet. This allows discovery to initialize the correct stage.

### 7. Automated stage changes needed a second safety boundary

Stage-safety logic existed during analysis but the general `apply` method accepted any requested stage. Thread-based and discovery-based flows need protection even when the normal matcher is bypassed.

**Fix:** Gmail uses a dedicated automated apply path that prevents ordinary backwards stage transitions while still allowing terminal offer/rejection signals.

## Existing security controls reviewed

The following controls were found to be appropriate for the current architecture:

- Gmail access is read-only (`gmail.readonly`).
- OAuth state is high entropy, stored only as a SHA-256 hash, expires after 10 minutes, and is single-use.
- The OAuth callback is public only because the cross-site Google redirect cannot rely on the application's strict session cookie; user binding is performed by OAuth state.
- Refresh tokens are encrypted at rest with AES-GCM; access tokens are not persisted.
- Gmail message bodies are not persisted by the synchronization layer. Processed-message storage contains message metadata, signal, match score and application association.

## Remaining V3 improvements

### Structured interview extraction

Extract and persist:

- interview date/time/timezone
- Google Meet / Teams / Zoom link
- interview type
- interviewer/recruiter name
- reschedule/cancellation signals

This should create/update `InterviewEntity` instead of only recording an activity event.

### Auto-created application review queue

Automatically created applications currently carry a note asking the user to verify extracted information. A dedicated review queue would be safer and easier to use:

- `À vérifier` badge
- confidence score and extraction reasons
- accept/edit/merge/delete actions
- one-click merge with an existing application

### Offer semantics

`RecruitmentStage.OFFRE` currently maps to the coarse application status `ACCEPTE`. Receiving an offer and accepting an offer are different business events. This should be redesigned before relying on Gmail offer detection for final acceptance reporting.

### Synchronization concurrency

Manual sync and scheduled sync can theoretically overlap on the same account. The current single-instance deployment reduces the practical risk, but a per-connection lock or database lease should be added before horizontal scaling.

### Sync coverage controls

The current initial lookback is bounded and the full-scan message count is deliberately limited. Add user-facing controls for:

- lookback window (30 / 60 / 90 days)
- maximum scan size
- optional Gmail labels
- explicit re-index/rebuild operation

### Better observability

Add metrics for:

- messages scanned
- signals detected
- applications matched
- applications created
- ambiguous messages
- thread-based matches
- duplicate creations prevented
- extraction confidence distribution

## Recommended acceptance tests

Before considering the Gmail feature mature, maintain fixtures covering at least:

1. Greenhouse acknowledgement -> technical interview -> rejection.
2. Workday acknowledgement where sender domain is generic.
3. Recruiter person on a corporate domain (`Jane Doe <jane@company.com>`).
4. Sender changes inside the same Gmail thread.
5. Same company with two different open positions.
6. Existing placeholder application followed by a mail that reveals the position.
7. Offer followed by rejection and rejection followed by later offer, preserving chronological semantics.
8. French and English reschedule/cancellation mails.
9. HTML-only and multipart MIME messages.
10. Manual rescan without duplicate activity creation.
