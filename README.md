# JobTrackr

JobTrackr is a **generic job-search workspace** for tracking applications, follow-ups, recruiters, interviews and pipeline analytics.

The current V1 supports two operating modes:

- **Local mode** — no account required; profile and applications stay in the browser.
- **Cloud mode** — optional account backed by Spring Boot and PostgreSQL, with authenticated per-user data isolation.

Existing local data is **never uploaded automatically** when a user signs in. Importing browser data into a cloud account requires an explicit action from the Account page.

**Frontend deployment:** https://trackmyjob-zakaria.netlify.app/

> The repository now contains the cloud backend and frontend integration. A production backend/reverse-proxy deployment is still required before the hosted frontend can use cloud mode; local mode remains independent.

## V1 product flow

```text
Without an account
──────────────────
Onboarding
   ↓
Local profile + LocalStorage applications
   ↓
Dashboard / List / Kanban / Interviews / Follow-ups

Optional cloud account
──────────────────────
Register / Login
   ↓
JWT-authenticated workspace
   ↓
Spring Boot REST API
   ↓
PostgreSQL

Existing browser data
   ↓
Explicit "Importer mes données locales"
   ↓
Duplicate-aware cloud import
```

Routes:

```text
/onboarding
/dashboard
/applications
/settings/profile
/account
```

## Product principles

- **Generic by default** — no hard-coded candidate identity or real application seed.
- **Local-first** — the application remains useful without signup or backend availability.
- **Cloud is opt-in** — signing in does not silently upload existing browser data.
- **Tenant isolation** — backend resources are resolved from the authenticated JWT user, never from a client-supplied `userId`.
- **Workflow correctness** — recruitment stage remains the source of truth for derived status.
- **Incremental architecture** — the existing Angular dashboard, forms, filters and Kanban continue to consume the same state facade in local and cloud modes.

## Features

### Application tracking

- company and position
- original offer URL
- CDI / CDD / freelance / internship / apprenticeship / other
- annual salary or freelance daily-rate target
- recruitment stage and derived status
- high / medium / low priority
- next follow-up date
- recruiter name, email and phone
- notes
- interview tracking and browser reminders
- JSON import/export

### Pipeline

- search and filtering
- sortable/paginated table
- Kanban with Angular CDK drag-and-drop
- compact stage cards and visual progression
- mobile previous/next stage controls
- overdue follow-up highlighting
- application details and editing

### Dashboard

- candidate profile context
- total applications
- response rate
- follow-ups requiring action
- interviews in the next 14 days
- high-priority active applications
- application-status distribution
- weekly application activity

### Optional cloud account

- account registration and login
- BCrypt password hashes server-side
- bearer JWT authentication
- authenticated profile persistence
- authenticated application persistence
- interview persistence
- explicit local-to-cloud import
- duplicate-aware import
- logout restores the untouched browser-local workspace

## Workflow invariant

Recruitment stage is authoritative:

```text
Candidature                                      -> Envoyé
Screening RH                                     -> Entretien
Entretien technique                              -> Entretien
Hiring Manager                                   -> Entretien
Entretien final                                  -> Entretien
Offre                                            -> Accepté
Clôturé                                          -> Refusé
```

The backend derives status from stage instead of trusting contradictory client values.

## Architecture

```text
Browser
│
├── Anonymous / local mode
│      Angular
│        ↓
│      StorageService
│        ↓
│      LocalStorageJobApplicationRepository
│
└── Authenticated / cloud mode
       Angular
         ↓
       StorageService
         ↓
       CloudApiService
         ↓ REST + Bearer JWT
       Spring Boot 4.1
         ↓
       Spring Security
         ↓
       JPA / Hibernate
         ↓
       PostgreSQL
```

The application is intentionally a **modular monolith** at V1. Backend packages separate authentication, users, profiles, applications, interviews, security and common API behavior without introducing premature distributed-system complexity.

### Frontend structure

```text
src/app
├── cloud
│   ├── auth.interceptor.ts
│   ├── auth.service.ts
│   ├── cloud-api.service.ts
│   ├── cloud-session.store.ts
│   └── cloud-workspace.service.ts
├── components
│   ├── account
│   ├── application-details
│   ├── application-filters
│   ├── application-kanban
│   ├── application-list
│   ├── dashboard
│   ├── job-form
│   ├── job-list
│   └── profile-editor
├── data
├── domain
├── guards
├── models
└── services
```

### Backend structure

```text
backend/src/main/java/dev/jobtrackr
├── application
├── auth
├── common
├── domain
├── interview
├── profile
├── security
└── user
```

Flyway owns the PostgreSQL schema; Hibernate runs with `ddl-auto=validate`.

## Cloud API

Authentication:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

Profile:

```text
GET /api/v1/profile
PUT /api/v1/profile
```

Applications:

```text
GET    /api/v1/applications
POST   /api/v1/applications
GET    /api/v1/applications/{id}
PUT    /api/v1/applications/{id}
PATCH  /api/v1/applications/{id}/stage
DELETE /api/v1/applications/{id}
```

Interviews and utility endpoints:

```text
POST   /api/v1/applications/{id}/interviews
PUT    /api/v1/applications/{id}/interviews/{interviewId}
DELETE /api/v1/applications/{id}/interviews/{interviewId}
POST   /api/v1/applications/import
GET    /api/v1/applications/export
GET    /api/v1/applications/follow-ups/due
```

## Tenant isolation

The JWT subject contains the server-side user UUID. Controllers do not accept a user id in application payloads.

Repository lookups use the authenticated owner, for example conceptually:

```text
(application_id, authenticated_user_id)
```

Guessing another application UUID therefore does not bypass ownership checks.

## Local-to-cloud migration

Signing in switches the active workspace to cloud data but does not upload LocalStorage records.

The Account page exposes an explicit import action. When chosen:

1. local profile data can be copied to the authenticated profile;
2. local applications are posted through the duplicate-aware import endpoint;
3. the cloud workspace is reloaded from the server;
4. the original LocalStorage dataset remains untouched.

Signing out switches the state facade back to that browser-local dataset.

## Tech stack

### Frontend

- Angular 21
- TypeScript 5.9
- Angular Material / CDK
- Angular Router + Reactive Forms
- RxJS
- Chart.js / ng2-charts
- Vitest + jsdom + V8 coverage

### Backend

- Java 21
- Spring Boot 4.1
- Spring Web MVC
- Spring Security + OAuth2 Resource Server JWT support
- Spring Data JPA / Hibernate
- PostgreSQL
- Flyway
- Actuator
- Testcontainers
- Maven

### Delivery

- GitHub Actions
- Docker / Docker Compose
- Netlify for the existing frontend deployment

## Run locally

Requirements:

- Node.js version from `.nvmrc`
- Java 21
- Docker

Start PostgreSQL:

```bash
docker compose -f backend/compose.yml up -d
```

Start the backend:

```bash
cd backend
mvn spring-boot:run
```

In another terminal, start Angular:

```bash
nvm use
npm ci
npm start
```

`npm start` uses `proxy.conf.json`, forwarding `/api` and `/actuator` to `http://localhost:8080`.

Open:

```text
http://localhost:4200
```

## Environment variables

Backend production configuration should provide at least:

```text
DATABASE_URL
DATABASE_USERNAME
DATABASE_PASSWORD
JWT_SECRET
CORS_ALLOWED_ORIGINS
```

`JWT_SECRET` must not use the development default in a deployed environment.

See `backend/README.md` for backend details.

## Testing and CI

Frontend:

```bash
npm run test:ci
npm run build -- --configuration production
```

Backend:

```bash
mvn -B -f backend/pom.xml verify
```

Backend integration tests run against a real PostgreSQL Testcontainer and cover authentication, profile persistence, cross-user application isolation and interview replacement through the application update flow.

Every pull request and push to `master` runs independent frontend and backend jobs.

## Current limitations

Cloud V1 is implemented in the repository, but several production concerns intentionally remain outside this milestone:

- no production backend hosting/reverse proxy has been configured in this repository yet;
- access tokens currently use a single HMAC signing secret rather than an external OIDC identity provider;
- no refresh-token/session-rotation flow yet;
- no server-side email or push notification scheduler yet;
- no Google Calendar / Outlook integration yet;
- no billing or Free/Pro entitlements yet;
- no end-to-end browser suite yet;
- compensation formatting remains EUR-oriented;
- browser reminders remain best-effort while the browser is open.

## Next milestones

```text
1. Production deployment
   ├── managed PostgreSQL
   ├── backend hosting
   ├── reverse proxy / API routing
   ├── secrets
   └── HTTPS + health checks

2. Production auth hardening
   ├── OIDC provider or asymmetric JWT signing
   ├── refresh/session strategy
   └── account recovery / email verification

3. Durable follow-ups
   ├── server scheduler
   ├── email / push notifications
   └── timezone-aware delivery

4. Integrations
   ├── Google Calendar / Outlook
   ├── job URL importer
   ├── CSV / Excel
   └── browser extension

5. Optional product layer
   ├── AI job/CV assistance
   ├── advanced analytics
   └── subscriptions / Free-Pro plans
```
