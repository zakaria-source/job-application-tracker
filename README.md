# JobTrackr

JobTrackr is a personalized Angular job-search workspace built around **Zakaria Dbaba's current Backend Java / Cloud-Native search**. It combines a real recruiting pipeline, follow-ups, recruiter context, compensation targets, interview reminders and analytics in one local-first application.

**Live demo:** https://trackmyjob-zakaria.netlify.app/

## Current profile represented in the product

The dashboard is intentionally tied to the current professional profile rather than generic demo copy:

- **Zakaria Dbaba** — Ingénieur Backend Java / Cloud-Native
- **4 years of professional experience**
- Java 17/21, Spring Boot 3, Kafka, PostgreSQL, Kubernetes, Terraform, AWS and Testcontainers
- CKA, AWS Developer – Associate and Terraform Associate
- ENSEEIHT engineering degree in Computer Science & Telecommunications
- France, with mobility to Paris / Luxembourg
- current compensation target displayed in the workspace: **65 k€ CDI / 550 €/day freelance**

The public UI intentionally does **not** expose private phone or email information.

## Current application dataset

On the first load of the current portfolio-data version, JobTrackr safely adds the applications currently tracked for:

- Mirakl
- Doctolib
- triPica
- Malt
- Crédit Agricole CIB
- Dassault Systèmes
- leboncoin
- Airbus Defence and Space

These records include the real role title, application date, source offer URL, follow-up date, compensation target when known, primary recruiting contact when useful, priority and recruiting notes.

The bootstrap is **merge-only**. It never overwrites an existing equivalent application. Matching uses stable IDs, normalized offer URLs and normalized company/role identity so an existing browser record keeps its manual edits.

## Product scope

- **Dashboard** — personalized profile context plus due follow-ups, high-priority opportunities, upcoming interviews and analytics.
- **Applications** — operational workspace to create, filter, inspect, edit, back up and restore applications in list or Kanban mode.

Angular Router exposes the workspace as real routes:

```text
/dashboard
/applications
```

## Features

### Application workflow

- Company and position
- Original job-offer URL
- Contract type: CDI, CDD, freelance, internship, apprenticeship or other
- Target annual salary or freelance daily rate (TJM)
- Recruitment stage and derived application status
- Priority: high, medium or low
- Explicit next follow-up date
- Recruiter name, email and phone
- Free-form notes
- Interview tracking and browser reminders

The recruitment stage is the workflow source of truth. JobTrackr derives the broad status from it so impossible combinations such as `Envoyé + Offre` cannot be created.

### Pipeline management

- Search by company, position, recruiter, stage or notes
- Filter by status, contract type and priority
- Switch between table and Kanban representations without losing filters
- Sort and paginate the table view
- Drag applications between recruitment stages in the Kanban using Angular CDK
- Persist Kanban transitions through the state facade, including derived status and first-response metadata
- Highlight follow-ups that are due on both representations
- Keyboard-accessible application rows and Kanban cards
- Open the original offer directly from the pipeline
- Detailed application view with compensation, recruiter and interview context
- Versioned JSON export/import for backup and device migration

### Job-search cockpit

- Current Backend Java / Cloud-Native profile summary
- Total applications
- Response rate
- Follow-ups requiring action
- Interviews scheduled in the next 14 days
- High-priority active pipeline
- Application-status distribution
- ISO-week application activity

## Tech stack

- Angular 21
- TypeScript 5.9
- Angular Material / CDK 21
- Angular CDK Drag & Drop
- Angular Router
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
│   └── job-list          # Applications page orchestrator
├── data
│   ├── current-applications.data.ts
│   ├── current-profile.data.ts
│   └── local-storage-job-application.repository.ts
├── domain
│   └── application-workflow.service.ts
├── models
│   └── job-application.model.ts
├── services
│   ├── application-analytics.service.ts
│   ├── follow-up.service.ts
│   ├── notification.service.ts
│   ├── portfolio-bootstrap.service.ts
│   └── storage.service.ts
├── app.routes.ts
├── app.component.ts
├── app.component.html
└── app.component.css
```

### Applications workspace

```text
JobListComponent
    │
    ├── ApplicationFiltersComponent
    │      └── emits typed filter criteria
    │
    ├── ApplicationListComponent
    │      └── table / sort / pagination / row actions
    │
    ├── ApplicationKanbanComponent
    │      └── CDK drag & drop / presentation / stage-change events
    │
    ├── ApplicationDetailsComponent
    │      └── application detail presentation and actions
    │
    └── JobFormComponent
           └── create / edit form
```

`JobListComponent` coordinates page state and CRUD operations. Presentation-specific logic remains inside focused standalone components.

### Responsibility boundaries

```text
Current profile + application seed
    │
    ▼
PortfolioBootstrapService
    │ merge-only
    ▼
StorageService (state facade)
    │
    ├── LocalStorageJobApplicationRepository
    │      └── persistence / hydration / schema migration / import-export
    │
    ├── ApplicationAnalyticsService
    │      └── response rates / ISO weekly activity / calendar response timing
    │
    └── FollowUpService
           └── due actions / suggestions

ApplicationWorkflowService
    └── recruitment-stage and status invariants
```

Kanban drag events carry only the application id and target recruitment stage. `StorageService` applies the state transition and delegates the stage-to-status rule to `ApplicationWorkflowService`. The Kanban never writes persistence directly.

## Local-first persistence

Persistence uses a versioned envelope:

```json
{
  "version": 2,
  "applications": []
}
```

The repository remains backward compatible with the original array-only LocalStorage format. Hydration validates persisted enum-like fields, rebuilds dates, migrates legacy recruiter fields and normalizes workflow state before publishing data.

The personalized bootstrap has its own version marker. When a new curated dataset is shipped, only applications missing from the browser are merged in. Existing notes, stages, priorities and manual edits are preserved.

Users can export the complete dataset as JSON and import it later. Import intentionally replaces the current local dataset after confirmation.

## Analytics correctness

Weekly application activity uses the **ISO week-year**, including the correct year around New Year boundaries. Response times are calculated from calendar dates in UTC rather than raw elapsed milliseconds, avoiding daylight-saving-time distortions.

## Follow-up and reminder logic

Explicit follow-up dates drive the cockpit. Active applications whose follow-up date is today or overdue are surfaced as actions and visually highlighted in the Kanban.

For older records without a follow-up date, a sent application older than seven days is flagged as needing a follow-up plan.

Browser reminder permission is requested only after a user explicitly enables an interview reminder. Timers are rebuilt from persisted application state whenever the application collection is restored or changed, preventing duplicate timers and recovering reminders after a page refresh.

A fully closed browser still cannot guarantee delivery; durable background notifications belong in the future backend/service-worker architecture.

## Testing

Business-critical behavior is covered with Vitest:

- workflow/status normalization
- legacy LocalStorage migration
- versioned persistence
- current-data merge bootstrap and duplicate protection
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

## Dependency security

The frontend was migrated from Angular 19 to Angular 21 using Angular's official sequential migrations rather than forcing npm to accept breaking dependency changes.

The remediation deliberately avoids `npm audit fix --force` and `--legacy-peer-deps`.

`npm audit --omit=dev` reports **0 production dependency vulnerabilities** and CI enforces that production boundary.

## CI/CD

Every pull request and push to `master` executes:

```bash
npm ci
npm audit --omit=dev
npm run test:ci
npm run build -- --configuration production
```

Netlify provides Deploy Previews for pull requests and production deployment from the default branch.

## Engineering decisions

### Why use real current data instead of generic demo records?

The project doubles as a working job-search tool and a portfolio project. Real application context demonstrates an actual workflow and produces meaningful dashboard analytics. The curated dataset excludes the owner's private phone/email and uses merge-only bootstrapping to preserve browser edits.

### Why local storage?

The current version remains intentionally frontend-only. It demonstrates application modeling, reactive state, persistence, schema migration and data visualization while keeping deployment lightweight.

### Why a repository boundary?

Components and state services never manipulate browser storage directly. The LocalStorage repository can later be replaced by an HTTP implementation without rewriting the product workflow.

### Why derive status from recruitment stage?

`stage` contains the detailed recruiting workflow while `status` is a coarse reporting dimension. Deriving the latter removes contradictory state and makes drag-and-drop transitions deterministic.

### Why keep Kanban ordering non-persistent?

The current domain model defines recruitment stage but not a manual rank inside a stage. CDK therefore supports moving cards between columns while same-column sorting is intentionally disabled. Persisting arbitrary order later would require an explicit ordering field rather than hidden UI-only state.

### Why Router instead of tabs?

Dashboard and Applications have stable URLs, browser history and direct navigation. This also prepares the application for future application-detail and settings routes.

## Current limitations

The remaining limitations are architectural rather than unresolved frontend correctness bugs:

- data is browser-local unless exported/imported
- no authentication or user accounts
- no server-side persistence
- browser reminders cannot run reliably while the browser is completely closed
- no end-to-end browser test suite yet
- manual ordering of cards inside a single Kanban stage is intentionally not persisted

These belong to the backend / platform phase rather than being hidden behind frontend workarounds.

## Full-stack roadmap

```text
Angular
   │ REST / OAuth2
   ▼
Spring Boot
   │
   ├── PostgreSQL
   ├── Spring Security / JWT or OIDC
   ├── OpenAPI
   └── scheduled/event-driven reminders
```

Next engineering milestones:

1. Spring Boot REST API and PostgreSQL persistence
2. Authentication with Spring Security and OAuth2/OIDC
3. Docker Compose local environment
4. Integration testing with Testcontainers
5. OpenAPI documentation
6. End-to-end browser testing
7. Cloud deployment and observability
8. Optional Kafka event flow where asynchronous events add real value

The frontend is structured so browser persistence can later be replaced by an API-backed repository without redesigning the domain workflow.
