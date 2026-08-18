# JobTrackr

JobTrackr is a **local-first job application tracking workspace** for candidates who want to manage applications, follow-ups, recruiters, interviews and job-search analytics in one place.

The product is no longer tied to a specific candidate profile or a curated personal application dataset. A first-run onboarding creates a local user profile, and the workspace starts empty unless the user explicitly chooses to load fictional demo data.

**Live application:** https://trackmyjob-zakaria.netlify.app/

## Product principles

- **Generic by default** — no hard-coded owner name, career target, compensation target or real applications.
- **Local-first** — profile and application data stay in the browser in the current frontend-only version.
- **Safe onboarding** — existing application data is never replaced when a user creates or edits a profile.
- **Demo data is opt-in** — three fictional applications can be merged into the workspace to explore the product.
- **Workflow correctness first** — recruitment stage remains the source of truth for derived application status.
- **Backend-ready boundaries** — persistence is isolated behind a repository/state facade so LocalStorage can later be replaced by an HTTP implementation.

## Current product flow

```text
First visit
   │
   ▼
Onboarding
   │
   ├── name / target role
   ├── experience / location
   ├── skills / certifications
   ├── education / compensation target
   └── optional fictional demo data
   │
   ▼
Dashboard
   │
   ├── profile context
   ├── KPIs
   ├── follow-ups
   ├── high-priority pipeline
   ├── interview agenda
   └── analytics
   │
   ▼
Applications workspace
   ├── table
   ├── Kanban
   ├── create / edit / delete
   ├── filters
   ├── recruiter context
   ├── interviews
   └── import / export
```

Routes:

```text
/onboarding
/dashboard
/applications
/settings/profile
```

Dashboard and Applications require a local profile. If none exists, JobTrackr redirects to onboarding.

## Features

### Application workflow

- Company and position
- Original job-offer URL
- Contract type: CDI, CDD, freelance, internship, apprenticeship or other
- Target annual salary or freelance daily rate
- Recruitment stage and derived application status
- Priority: high, medium or low
- Explicit next follow-up date
- Recruiter name, email and phone
- Free-form notes
- Interview tracking and browser reminders

The recruitment stage is the workflow source of truth. JobTrackr derives the broad status from it so contradictory combinations such as `Envoyé + Offre` cannot be created.

### Pipeline management

- Search by company, position, recruiter, stage or notes
- Filter by status, contract type and priority
- Table and Kanban representations
- Sort and pagination in table mode
- Angular CDK drag-and-drop between recruitment stages
- Persistent stage transitions through the state facade
- Follow-up highlighting
- Keyboard-accessible rows and Kanban cards
- Direct access to original offer URLs
- Detailed application view
- Versioned JSON export/import

### Dashboard

- User-configured profile summary
- Total applications
- Response rate
- Follow-ups requiring action
- Interviews scheduled in the next 14 days
- High-priority active pipeline
- Application-status distribution
- ISO-week application activity

### Profile & onboarding

The profile is stored separately from applications under its own LocalStorage key. Only the displayed job-search context is stored:

- display name
- target role / headline
- experience label
- location or mobility
- summary
- key skills
- certifications
- education
- compensation target

Only name and target role are required.

### Optional demo mode

Users can opt in to three fictional applications during onboarding or from profile settings. Demo records use fictional organizations and people and are merged through the same duplicate-protection logic used by the application state facade.

Loading demo data never replaces existing applications.

## Tech stack

- Angular 21
- TypeScript 5.9
- Angular Material / CDK 21
- Angular CDK Drag & Drop
- Angular Router
- Reactive Forms
- RxJS
- Chart.js / ng2-charts 10
- Vitest + jsdom + V8 coverage
- Browser Local Storage
- GitHub Actions
- Netlify

## Architecture

```text
src/app
├── components
│   ├── application-details
│   ├── application-filters
│   ├── application-kanban
│   ├── application-list
│   ├── dashboard
│   ├── job-form
│   ├── job-list
│   └── profile-editor
├── data
│   └── local-storage-job-application.repository.ts
├── domain
│   └── application-workflow.service.ts
├── guards
│   └── profile-required.guard.ts
├── models
│   ├── job-application.model.ts
│   └── user-profile.model.ts
├── services
│   ├── application-analytics.service.ts
│   ├── demo-data.service.ts
│   ├── follow-up.service.ts
│   ├── notification.service.ts
│   ├── storage.service.ts
│   └── user-profile.service.ts
├── app.routes.ts
├── app.component.ts
├── app.component.html
└── app.component.css
```

### Responsibility boundaries

```text
UserProfileService
    └── local profile persistence

ProfileRequiredGuard
    └── first-run onboarding protection

DemoDataService
    └── opt-in fictional examples
          │
          ▼
StorageService
    │
    ├── LocalStorageJobApplicationRepository
    │      └── persistence / hydration / schema migration / import-export
    │
    ├── ApplicationAnalyticsService
    │      └── response rates / ISO weekly activity / response timing
    │
    └── FollowUpService
           └── due actions / suggestions

ApplicationWorkflowService
    └── recruitment-stage and status invariants
```

Kanban drag events carry only the application id and target recruitment stage. `StorageService` applies the state transition and delegates stage-to-status rules to `ApplicationWorkflowService`. Presentation components never write persistence directly.

## Local-first persistence

Applications use a versioned envelope:

```json
{
  "version": 2,
  "applications": []
}
```

The repository remains backward compatible with the original array-only LocalStorage format. Hydration validates persisted enum-like fields, rebuilds dates, migrates legacy recruiter fields and normalizes workflow state before publishing data.

The user profile is persisted independently, so profile changes do not rewrite or reset applications.

Users can export the complete application dataset as JSON and import it later. Import intentionally replaces the current application dataset after confirmation; it does not replace the local profile.

## Migration from the personalized prototype

The generic V1 deliberately removes:

- the hard-coded owner career profile
- the real owner application seed
- automatic portfolio-data bootstrapping
- personalized dashboard and shell copy

Existing LocalStorage application data remains compatible. A returning browser with old application data is asked to complete the new onboarding profile, after which the existing pipeline remains available.

## Analytics correctness

Weekly application activity uses the **ISO week-year**, including year boundaries. Response times are calculated from calendar dates in UTC rather than raw elapsed milliseconds, avoiding daylight-saving-time distortions.

## Follow-up and reminder logic

Explicit follow-up dates drive the cockpit. Active applications whose follow-up date is today or overdue are surfaced as actions and visually highlighted in the Kanban.

For older records without a follow-up date, a sent application older than seven days is flagged as needing a follow-up plan.

Browser reminder permission is requested only after a user explicitly enables an interview reminder. Timers are rebuilt from persisted application state whenever the collection is restored or changed, preventing duplicate timers and recovering reminders after page refresh.

A fully closed browser still cannot guarantee delivery; durable background notifications belong in the future backend/service-worker architecture.

## Testing

Business-critical behavior is covered with Vitest, including:

- workflow/status normalization
- legacy LocalStorage migration
- versioned persistence
- user-profile persistence and validation
- opt-in demo-data merge and duplicate protection
- follow-up eligibility
- ISO week-year analytics and calendar-safe response timing
- CRUD persistence
- export/import round-trip
- Applications component contracts
- Kanban grouping and drag stage changes
- state-facade workflow transitions

Run locally:

```bash
npm test
```

CI run with coverage:

```bash
npm run test:ci
```

## Run locally

Node.js 20 is the reference runtime and is declared in `.nvmrc`.

```bash
nvm use
npm ci
npm start
```

Then open `http://localhost:4200`.

## Production build

```bash
npm run build -- --configuration production
```

## CI/CD

Every pull request and push to `master` executes:

```bash
npm ci
npm audit --omit=dev
npm run test:ci
npm run build -- --configuration production
```

Netlify provides Deploy Previews for pull requests and production deployment from the default branch.

## Current limitations

The remaining limitations are architectural rather than hidden frontend workarounds:

- data is browser-local unless exported/imported
- no authentication or user accounts
- no server-side persistence
- browser reminders cannot run reliably while the browser is completely closed
- no end-to-end browser test suite yet
- manual ordering of cards inside a single Kanban stage is intentionally not persisted
- compensation formatting is still oriented toward the current EUR-focused product version

## Full-stack roadmap

```text
Angular
   │ REST / OAuth2
   ▼
Spring Boot
   │
   ├── PostgreSQL
   ├── Spring Security / OIDC
   ├── OpenAPI
   ├── scheduled reminders
   └── observability
```

Next engineering milestones:

1. Spring Boot REST API and PostgreSQL persistence
2. Authentication with Spring Security and OAuth2/OIDC
3. Per-user ownership and authorization on every application resource
4. Docker Compose local environment
5. Integration testing with Testcontainers
6. OpenAPI documentation
7. End-to-end browser testing
8. Cloud deployment and observability
9. Durable email/push reminders
10. Optional event-driven integrations where asynchronous events add real value

The current frontend remains intentionally structured so LocalStorage persistence can later be replaced by an API-backed repository without redesigning the application workflow.
