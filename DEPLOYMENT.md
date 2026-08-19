# JobTrackr production deployment

JobTrackr uses three deployment platforms:

```text
Browser
  ↓
Netlify · Angular
  ↓ /api reverse proxy
Render · Spring Boot
  ↓ TLS
Neon · PostgreSQL
```

The repository is a monorepo with the Angular application in `frontend/` and the Spring Boot API in `backend/`.

## 1. Neon PostgreSQL

Create a Neon project and keep these values outside the repository:

```text
DATABASE_HOST=ep-...eu-central-1.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=<generated Neon password>
```

Spring Boot assembles the production JDBC URL with TLS:

```text
jdbc:postgresql://${DATABASE_HOST}:5432/${DATABASE_NAME}?sslmode=require
```

HikariCP uses a deliberately small pool for the current low-traffic deployment. Flyway owns business schema migrations, rotating auth sessions, and the optional Gmail connection/synchronization tables.

## 2. Render backend

Create a Render Blueprint from the repository-root `render.yaml`.

The Blueprint provisions the `jobtrackr-api` web service and expects the Neon variables to be supplied as environment variables. Production secrets such as `JWT_SECRET`, the database password, and Google OAuth credentials must never be committed.

The health endpoint is:

```text
/actuator/health
```

Render Free can sleep when idle, so the first request after inactivity may be slower. The in-process Gmail scheduler also pauses while the instance is asleep; users can always trigger a synchronization from the Applications workspace after the backend wakes up.

Production auth defaults are:

```text
access JWT cookie: 15 minutes
refresh session:    30 days
```

The access JWT is signed with `JWT_SECRET`. Refresh credentials are random opaque values; only their SHA-256 hash is stored in PostgreSQL. Refreshing rotates the credential and replay of an older refresh credential revokes the session.

## 3. Netlify frontend

The root `netlify.toml` declares:

```toml
[build]
  base = "frontend"
  command = "npm run build:netlify"
  publish = "dist/demo/browser"
```

Configure:

```text
JOBTRACKR_API_ORIGIN=https://<service>.onrender.com
```

Use the HTTPS origin only, without `/api` or a trailing path.

The frontend build generates:

```text
/api/*  https://<service>.onrender.com/api/:splat  200
/*      /index.html                               200
```

The first rule keeps browser API calls same-origin through Netlify. This is important for the cookie + XSRF browser-auth contract and lets the Google OAuth callback use the public Netlify origin while being proxied to Render. The second rule preserves Angular client-side routing.

## 4. Gmail OAuth and periodic synchronization

Gmail integration is optional. When the Google credentials are absent, JobTrackr starts normally and reports the Gmail integration as unavailable.

### Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen.
4. While developing, keep the app in testing mode and add the Gmail accounts that should be allowed to authorize JobTrackr as test users.
5. Create an OAuth 2.0 Client ID of type **Web application**.
6. Add this exact production authorized redirect URI:

```text
https://trackmyjob-zakaria.netlify.app/api/v1/gmail/oauth/callback
```

For local development, add:

```text
http://localhost:8080/api/v1/gmail/oauth/callback
```

The application requests only:

```text
https://www.googleapis.com/auth/gmail.readonly
```

`gmail.readonly` is a restricted Google scope. A public production rollout can require Google OAuth verification, and applications that store or transmit restricted-scope data on servers may also be subject to Google's security-assessment requirements. Testing-mode access for explicitly added test users is useful while the OAuth app is being prepared for verification.

### Render environment

Set the Google-generated values manually on Render:

```text
GMAIL_CLIENT_ID=<Google OAuth web client id>
GMAIL_CLIENT_SECRET=<Google OAuth web client secret>
```

`render.yaml` defines the remaining production settings:

```text
GMAIL_TOKEN_ENCRYPTION_KEY=<Render-generated deployment secret>
GMAIL_REDIRECT_URI=https://trackmyjob-zakaria.netlify.app/api/v1/gmail/oauth/callback
GMAIL_FRONTEND_BASE_URL=https://trackmyjob-zakaria.netlify.app
GMAIL_SYNC_DELAY_MS=900000
GMAIL_INITIAL_LOOKBACK_DAYS=30
GMAIL_AUTO_APPLY_MIN_MATCH=70
GMAIL_AUTO_APPLY_MIN_CONFIDENCE=80
```

Do not reuse `JWT_SECRET` as the Gmail encryption key. Gmail refresh tokens are encrypted with AES-GCM using `GMAIL_TOKEN_ENCRYPTION_KEY`. Short-lived Gmail access tokens and message bodies are not persisted.

### Synchronization behavior

The first connection performs a bounded scan of recent Gmail messages, records the mailbox `historyId`, and deduplicates processed message IDs. Later synchronizations request only message additions since the stored history cursor. If Gmail reports that the stored cursor is no longer valid, JobTrackr falls back to another bounded recent scan.

The scheduler defaults to every 15 minutes while the Render process is running. A manual **Synchroniser** action uses the same sync path.

Automatic application updates require all of the following:

```text
recognized recruiting signal
signal confidence >= 80
best application match >= 70
best match at least 15 points above the second match when ambiguous
```

If those conditions are not met, the message is marked processed without silently changing a pipeline stage.

## 5. Browser authentication contract

Browser authentication is cookie-only:

```text
jobtrackr_session
  HttpOnly
  Secure in production
  SameSite=Strict
  Path=/api
  TTL=15 minutes

jobtrackr_refresh
  HttpOnly
  Secure in production
  SameSite=Strict
  Path=/api/v1/auth
  rotating session TTL=30 days

XSRF-TOKEN
  readable by Angular
  Secure in production
  SameSite=Strict
  Path=/
```

Angular sends `X-XSRF-TOKEN` on unsafe same-origin requests. Business mutations and logout require a valid CSRF token. Login, registration and refresh are deliberately CSRF-exempt so a session can be established or renewed.

The Google OAuth callback is a public `GET` endpoint authenticated by a single-use, high-entropy `state` value. JobTrackr stores only a SHA-256 hash of that state for ten minutes and deletes it when the callback is consumed. The browser's JobTrackr authentication cookie is not needed on the cross-site Google callback.

The browser never reads, stores or attaches the access JWT. `localStorage` contains only non-sensitive session metadata (`expiresAt`, `sessionExpiresAt`, user identity) used for UI state. Explicit non-browser API clients may still use `Authorization: Bearer ...`; they are handled by a separate Spring Security filter chain and do not rely on ambient cookies.

## 6. Refresh flow

When a protected request returns `401` because the 15-minute access cookie expired:

```text
Angular request
  ↓ 401
POST /api/v1/auth/refresh
  ↓ refresh cookie validated + rotated
new access cookie + new refresh cookie
  ↓
original request retried once
```

Angular shares one in-flight refresh request, preventing multiple simultaneous `401` responses from causing a refresh storm. If refresh fails, local session metadata is cleared and the user returns to the account screen.

## 7. Safe deployment order

Authentication protocol changes must be deployed using an expand → migrate → contract sequence rather than assuming Netlify and Render update at exactly the same time.

```text
A. Backend expands contract while remaining backward-compatible
B. Frontend migrates to the new contract
C. Backend enforces the new security contract
D. Legacy browser compatibility code is removed
```

The Gmail migration is additive: existing accounts continue to work without Google credentials, and the Gmail UI reports the integration as unavailable until its production secrets are configured.

During future distributed or Kubernetes rollouts, keep version N compatible with N-1 across the deployment window whenever an API contract changes.

## 8. Smoke test

After deployment:

1. Verify the backend health endpoint reports `UP`.
2. Verify `GET /api/v1/auth/capabilities` reports `cookie-refresh-csrf-v1` and `csrfEnforced=true`.
3. Open the Netlify application and register a test account.
4. Sign out and sign in again.
5. Confirm browser storage contains metadata only and no credential.
6. Create a fictional application and verify the mutation succeeds through XSRF protection.
7. Move it in Kanban and refresh; the stage must remain persisted.
8. Add or edit an interview and refresh.
9. Set and complete a follow-up.
10. Connect a Google test account from **Suivi Gmail** and confirm the OAuth callback returns to `/applications?gmail=connected` before the UI removes the transient query parameter.
11. Confirm the initial Gmail sync completes and a second sync is incremental/idempotent.
12. Use a fictional recruiter email matching a test application and confirm only a high-confidence, unambiguous signal updates the pipeline.
13. Disconnect Gmail and confirm the application continues to work normally.
14. Leave the application open long enough for an access-token refresh in a non-production test configuration, or exercise `/auth/refresh` in integration tests.
15. Export a backup, review an import preview, then import non-sensitive test data.
16. Confirm another browser session sees the same account data.

JobTrackr is cloud-only for business data. There is no anonymous/local application-data mode or application-data LocalStorage fallback.

## 9. CORS and domains

`render.yaml` keeps an explicit frontend origin allow-list for direct API diagnostics. Normal browser traffic uses the Netlify `/api` proxy.

When adding a custom frontend domain, update all three values together and redeploy:

```text
CORS_ALLOWED_ORIGINS=https://new.example
GMAIL_FRONTEND_BASE_URL=https://new.example
GMAIL_REDIRECT_URI=https://new.example/api/v1/gmail/oauth/callback
```

Also add the new exact callback URI to the Google OAuth web client.

## 10. Secrets

Never commit:

- Neon database passwords
- `JWT_SECRET`
- `GMAIL_CLIENT_ID` when deployment policy treats it as configuration metadata
- `GMAIL_CLIENT_SECRET`
- `GMAIL_TOKEN_ENCRYPTION_KEY`
- provider API tokens
- OAuth client secrets

Rotating `JWT_SECRET` invalidates current access JWTs. Existing refresh sessions can then issue fresh access JWTs after deployment, provided their server-side session has not expired or been revoked. Rotating the Neon password requires updating the Render environment variable and redeploying.

Rotating `GMAIL_TOKEN_ENCRYPTION_KEY` without re-encrypting existing Gmail refresh tokens makes existing Gmail connections unreadable. Disconnect/reconnect affected Gmail accounts after a deliberate key rotation, or perform a data migration that decrypts with the old key and encrypts with the new key.

## 11. Scaling notes

The access-token path is stateless: any Spring instance can validate the signed access JWT, so application requests do not require sticky sessions. Refresh-session and Gmail synchronization state live in PostgreSQL and are shared across instances.

The current Gmail scheduler is intentionally simple. Before running multiple backend replicas, add a distributed scheduler/lock or move periodic synchronization to a single worker so two instances do not compete to process the same mailbox concurrently. Database uniqueness still protects message deduplication, but single-owner scheduling avoids wasted provider calls.

The current request-rate limiter is intentionally lightweight and in-process. Before running multiple backend replicas under meaningful traffic, replace that implementation with a shared limiter such as Redis or an API-gateway/load-balancer quota. The job-import bulkhead is likewise per JVM; global egress concurrency belongs at the platform layer once multiple replicas are introduced.

## 12. Rollback

Frontend:

- restore a prior successful Netlify deploy that is compatible with the currently deployed backend contract.

Backend:

- redeploy a previous healthy commit from Render deploy history only if its API/auth contract remains compatible with the frontend currently served by Netlify.

Database:

- Flyway owns schema changes. Code rollback does not undo an applied migration. `V4__gmail_sync.sql` is additive, so leaving its tables in place is safe during a code rollback; do not manually drop Gmail tables while an older deployment may still be serving requests.

## 13. CI checks

Every pull request validates the deployable system.

Frontend checks run from `frontend/`:

```text
npm audit --omit=dev
Angular/Vitest tests
browser-auth credential boundary guard
Netlify production build
/api proxy rule
SPA fallback rule
```

Backend checks run from `backend/`:

```text
Maven verify
PostgreSQL Testcontainers integration tests
refresh rotation + replay protection
cookie/XSRF negative and positive cases
Gmail classifier + refresh-token encryption tests
Bearer API compatibility
production Docker image build
Render + Neon blueprint guard
```

Render uses `autoDeployTrigger: checksPass`, so backend deployment waits for repository checks.
