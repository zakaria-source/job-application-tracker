# JobTrackr

JobTrackr is a **generic job-search workspace** for tracking applications, follow-ups, recruiters, interviews and pipeline analytics.

The V1 supports two operating modes:

- **Local mode** — no account required; profile and applications stay in the browser.
- **Cloud mode** — optional account backed by Spring Boot and PostgreSQL with authenticated per-user isolation.

Existing browser data is **never uploaded automatically** when a user signs in. Local-to-cloud migration is an explicit action from the Account page.

**Frontend:** https://trackmyjob-zakaria.netlify.app/

## Product flow

```text
Anonymous / local
─────────────────
Angular
  ↓
StorageService
  ↓
LocalStorage

Authenticated / cloud
─────────────────────
Angular
  ↓ REST + JWT
Spring Boot
  ↓
PostgreSQL
```

Routes:

```text
/onboarding
/dashboard
/applications
/settings/profile
/account
```

## Features

### Applications

- company and position
- original job-offer URL
- CDI / CDD / freelance / internship / apprenticeship / other
- annual salary or freelance daily-rate target
- recruitment stage and derived status
- high / medium / low priority
- follow-up date
- recruiter name, email and phone
- notes
- interviews and browser reminders
- JSON import/export

### Pipeline

- search and filters
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
- due follow-ups
- interviews in the next 14 days
- high-priority applications
- status distribution
- weekly application activity

### Cloud account

- registration and login
- BCrypt password hashes
- stateless bearer JWT authentication
- profile persistence
- application persistence
- interview persistence
- duplicate-aware local-to-cloud import
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
├── Local mode
│      Angular
│        ↓
│      StorageService
│        ↓
│      LocalStorageJobApplicationRepository
│
└── Cloud mode
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

The backend is intentionally a **modular monolith** for V1. Authentication, users, profiles, applications, interviews and security are separated by package without introducing premature distributed-system complexity.

### Frontend

```text
src/app
├── cloud
├── components
├── data
├── domain
├── guards
├── models
└── services
```

### Backend

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

Flyway owns the PostgreSQL schema. Hibernate runs with `ddl-auto=validate`.

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

The JWT subject contains the server-side user UUID. Controllers never accept a client-supplied `userId` for ownership.

Application access is scoped by both resource id and authenticated owner id, preventing cross-account access by guessing UUIDs.

## Local-to-cloud migration

Signing in changes the active workspace to the authenticated cloud dataset but does not upload LocalStorage records.

The Account page provides an explicit **Importer mes données locales** action. When used:

1. local profile data can be copied to the cloud profile;
2. local applications go through duplicate-aware import;
3. the cloud workspace reloads from the server;
4. the original LocalStorage dataset remains untouched.

Signing out restores the local workspace.

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
- Docker
- Netlify — Angular frontend
- Render Free — Spring Boot API
- Neon Free — PostgreSQL

## Production topology

The portfolio-oriented baseline is:

```text
Browser
  ↓
Netlify
  ↓ /api/* proxy
Render Free Web Service
  ↓ TLS
Neon Free Postgres
```

`render.yaml` provisions **only** the Render Free web service. Neon is external and its database credentials are supplied to Render as secret environment variables.

The production datasource requires TLS and uses a deliberately small Hikari pool:

```text
maximumPoolSize = 5
minimumIdle     = 0
```

This works well with a low-traffic database that scales to zero when idle.

Provider free-plan limits and pricing can change. The repository is configured for a zero-cost baseline under the current Render, Neon and Netlify plans, not as a guarantee of permanent free hosting.

See **`DEPLOYMENT.md`** for the complete production setup and smoke-test procedure.

## Run locally

Requirements:

- Node.js version from `.nvmrc`
- Java 21
- Docker

Start PostgreSQL:

```bash
docker compose -f backend/compose.yml up -d
```

Start Spring Boot:

```bash
cd backend
mvn spring-boot:run
```

Start Angular in another terminal:

```bash
nvm use
npm ci
npm start
```

`npm start` proxies `/api` and `/actuator` to `http://localhost:8080`.

Open:

```text
http://localhost:4200
```

## Production environment variables

Render receives the Neon connection details as secrets:

```text
DATABASE_HOST
DATABASE_PORT=5432
DATABASE_NAME
DATABASE_USERNAME
DATABASE_PASSWORD
JWT_SECRET
JWT_TTL=PT12H
CORS_ALLOWED_ORIGINS
```

`JWT_SECRET` is generated by Render. Neon credentials must never be committed.

Netlify receives:

```text
JOBTRACKR_API_ORIGIN=https://<jobtrackr-api>.onrender.com
```

The Netlify build generates the `/api/*` reverse-proxy rule dynamically.

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

CI validates:

```text
Frontend
  npm audit
  Angular/Vitest tests
  Netlify production build
  /api reverse-proxy artifact
  SPA fallback

Backend
  Maven verify
  PostgreSQL Testcontainers
  production Docker image
  Render Free + external Neon blueprint guard
```

## Current limitations

- Free hosting can introduce backend/database cold-start latency after inactivity.
- Access tokens use a single HMAC signing secret rather than an external OIDC provider.
- No refresh-token/session-rotation flow yet.
- No account recovery or email verification yet.
- No server-side email/push scheduler yet.
- No Google Calendar / Outlook integration yet.
- No billing or Free/Pro entitlements yet.
- No end-to-end browser suite yet.
- Compensation formatting remains EUR-oriented.
- Browser reminders remain best-effort while the browser is open.

## Next milestones

```text
1. Apply production deployment
   ├── create Neon project
   ├── connect Render Blueprint
   ├── configure Netlify API origin
   └── production smoke tests

2. Auth hardening
   ├── OIDC or asymmetric JWT signing
   ├── refresh/session strategy
   ├── email verification
   └── account recovery

3. Durable follow-ups
   ├── server scheduler
   ├── email / push notifications
   └── timezone-aware delivery

4. Integrations
   ├── Google Calendar / Outlook
   ├── job URL importer
   ├── CSV / Excel
   └── browser extension
```
