# JobTrackr

JobTrackr is a cloud workspace for tracking job applications, follow-ups and interviews.

**Live app:** https://trackmyjob-zakaria.netlify.app/

## Features

- account-based workspace
- application tracking with list and Kanban views
- recruitment stages, priorities and follow-up dates
- recruiter and interview tracking
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
├── jobimport
├── profile
├── identity
├── common
└── security
```

Controllers handle HTTP concerns, services own use cases and transaction boundaries, entities own persistence state, DTOs define the API contract, and mappers translate persistence models to API responses.

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

Backend integration tests use PostgreSQL Testcontainers and include auth refresh rotation, replay revocation, cookie CSRF enforcement and explicit Bearer API compatibility.

## Logs and observability

The API writes concise structured logs to stdout so they are visible directly in Render.

- every API request receives an `X-Request-Id`
- request logs include method, path, HTTP status and duration
- authentication success events log only the user UUID
- application mutations log only resource UUIDs and workflow metadata
- handled API errors are logged with the same request correlation ID
- passwords, JWTs, request bodies, recruiter details and notes are never logged
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
- profile and application data are scoped to the authenticated user
- production database connections use TLS
- production secrets stay outside the repository
- business data is persisted in PostgreSQL, not browser LocalStorage

## Deployment

Production uses Netlify for the frontend, Render for the Spring Boot API and Neon for PostgreSQL.

Authentication changes follow an expand → migrate → enforce → contract rollout so frontend and backend deployments do not need to switch at exactly the same instant.

Deployment details, environment variables, auth flow, smoke tests and rollback notes are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).
