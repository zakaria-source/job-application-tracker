# JobTrackr

JobTrackr is a cloud workspace for tracking job applications, follow-ups and interviews.

**Live app:** https://trackmyjob-zakaria.netlify.app/

## Features

- account-based workspace
- application tracking with list and Kanban views
- recruitment stages, priorities and follow-up dates
- recruiter and interview tracking
- recruiter-email classification and application matching
- optional Gmail OAuth connection with periodic incremental synchronization
- action-oriented dashboard and pipeline metrics
- safe JSON backup import/export
- synchronized data across devices
- rotating cookie sessions with short-lived access JWTs
- CSRF-protected browser mutations

## Architecture

```text
Browser
  ↓
Netlify · Angular
  ↓ /api
Render · Spring Boot
  ↓
Neon · PostgreSQL
```

JobTrackr requires an account. Profile and application data are stored through the backend API and PostgreSQL; there is no LocalStorage business-data mode.

### Repository structure

```text
job-application-tracker/
├── frontend/                 # Angular application
│   ├── src/app/
│   │   ├── core/             # app-wide API, auth, workspace and notifications
│   │   ├── features/         # product features
│   │   │   ├── applications/
│   │   │   ├── dashboard/
│   │   │   ├── account/
│   │   │   └── profile/
│   │   └── shared/           # reusable UI primitives
│   ├── package.json
│   └── angular.json
├── backend/                  # Spring Boot API
│   └── src/main/java/dev/jobtrackr/
├── .github/workflows/        # CI
├── netlify.toml
├── render.yaml
└── DEPLOYMENT.md
```

### Frontend organization

The Angular codebase is feature-first. Product code lives next to the feature that owns it instead of being distributed across global `components`, `services` and `models` folders.

```text
frontend/src/app
├── core
│   ├── api
│   ├── auth
│   ├── notifications
│   └── workspace
├── features
│   ├── applications
│   │   ├── components
│   │   ├── data-access
│   │   ├── domain
│   │   ├── models
│   │   ├── pages
│   │   └── testing
│   ├── account
│   ├── dashboard
│   └── profile
└── shared
    └── ui
```

`ApplicationStore` owns application state and persistence coordination. Backup parsing/deduplication and serialization are isolated in `ApplicationImportService` and `ApplicationExportService`.

### Backend organization

The backend is organized by feature, while genuinely cross-cutting code stays under `common` and `security`.

```text
dev.jobtrackr
├── application
│   ├── domain
│   ├── interview
│   ├── tracking
│   ├── dto
│   ├── ApplicationController
│   ├── ApplicationService
│   ├── JobApplicationEntity
│   └── JobApplicationRepository
├── auth
│   ├── dto
│   ├── exception
│   ├── AuthController
│   ├── AuthService
│   └── AuthSessionEntity
├── gmail                   # OAuth, encrypted refresh token and periodic Gmail sync
├── mailtracking            # recruiter-email classification, matching and apply flow
├── jobimport
├── profile
├── identity
├── common
└── security
```

Controllers handle HTTP concerns, services own use cases and transaction boundaries, entities own persistence state, DTOs define the API contract, and mappers translate persistence models to API responses.

## Gmail synchronization

The Applications workspace supports both manual email analysis and an optional Gmail connection. Gmail uses a server-side OAuth 2.0 authorization-code flow with offline access. The first synchronization inspects a bounded recent window; later runs use Gmail history IDs for incremental synchronization and fall back to a bounded full synchronization if the history cursor has expired.

Automatic application updates are deliberately conservative. A message must have a high-confidence recruiting signal, a strong application match, and enough separation from the next-best match before JobTrackr updates the pipeline. Processed Gmail message IDs are persisted so the same message is not applied twice.

The backend scheduler defaults to a 15-minute delay. On a scale-to-zero/free hosting plan, scheduled work only runs while the backend instance is awake; the UI therefore also exposes a manual **Synchroniser** action.

## Stack

### Frontend

- Angular 21
- TypeScript
- Angular Material / CDK
- RxJS
- Chart.js
- Vitest

### Backend

- Java 21
- Spring Boot 4.1
- Spring Security
- Spring Data JPA / Hibernate
- PostgreSQL
- Flyway
- Testcontainers

### Delivery

- Docker
- GitHub Actions
- Netlify
- Render
- Neon

## Run locally

Requirements: Node.js, Java 21 and Docker.

Start PostgreSQL:

```bash
docker compose -f backend/compose.yml up -d
```

Start the API:

```bash
cd backend
mvn spring-boot:run
```

Start Angular:

```bash
cd frontend
npm ci
npm start
```

Open `http://localhost:4200`, create an account, then use the application through the local backend.

Gmail is optional locally. To enable it, create a Google OAuth web client and supply `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`, and a redirect URI matching `/api/v1/gmail/oauth/callback`. See `DEPLOYMENT.md` for the complete setup.

## Tests

Frontend:

```bash
cd frontend
npm run test:ci
npm run build -- --configuration production
```

Backend:

```bash
mvn -B -f backend/pom.xml verify
```

Backend integration tests use PostgreSQL Testcontainers and include auth refresh rotation, replay revocation, cookie CSRF enforcement and explicit Bearer API compatibility. Gmail-specific unit coverage verifies email classification and refresh-token encryption.

## Logs and observability

The API writes concise structured logs to stdout so they are visible directly in Render.

- every API request receives an `X-Request-Id`
- request logs include method, path, HTTP status and duration
- authentication success events log only the user UUID
- application mutations log only resource UUIDs and workflow metadata
- Gmail synchronization logs connection/user identifiers and aggregate counts, not message bodies or OAuth credentials
- handled API errors are logged with the same request correlation ID
- passwords, JWTs, OAuth tokens, request bodies, recruiter details and notes are never logged
- `/actuator/health` and `OPTIONS` requests are excluded from request logs to avoid noise

Example:

```text
2026-08-18T12:34:56.789Z INFO requestId=8c88... RequestLoggingFilter - http_request method=POST path=/api/v1/applications status=201 durationMs=42
```

The `X-Request-Id` response header is exposed through CORS, so a browser-side failure can be matched to the corresponding backend log entry.

## Security and privacy

- passwords are hashed with BCrypt
- browser access uses a 15-minute JWT in an HttpOnly/Secure/SameSite cookie
- refresh sessions are rotating, revocable, persisted server-side and default to 30 days
- only refresh credential hashes are stored in PostgreSQL
- Angular never reads or stores the access credential
- browser mutations and logout require `X-XSRF-TOKEN`
- explicit non-browser API clients may use `Authorization: Bearer` through a separate security chain
- Gmail access tokens are short-lived and are not persisted
- Gmail refresh tokens are encrypted at rest with AES-GCM using a dedicated deployment secret
- Gmail message bodies are processed ephemerally and are not stored; only deduplication/matching metadata and application activity signals are persisted
- profile and application data are scoped to the authenticated user
- production database connections use TLS
- production secrets stay outside the repository
- business data is persisted in PostgreSQL, not browser LocalStorage

## Deployment

Production uses Netlify for the frontend, Render for the Spring Boot API and Neon for PostgreSQL.

Authentication changes follow an expand → migrate → enforce → contract rollout so frontend and backend deployments do not need to switch at exactly the same instant.

Deployment details, environment variables, Gmail OAuth setup, smoke tests and rollback notes are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).
