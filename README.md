# JobTrackr

JobTrackr is an Angular application for managing a job-search pipeline: applications, recruiter contacts, compensation targets, follow-ups and interviews from one workspace.

**Live demo:** https://trackmyjob-zakaria.netlify.app/

## Product scope

The product has two deliberately distinct areas:

- **Dashboard** — a job-search cockpit showing what needs attention now: due follow-ups, high-priority opportunities and upcoming interviews, followed by analytics.
- **Applications** — the operational workspace to create, filter, inspect, edit and delete applications.

## Features

### Application workflow

- Company and position
- Original job-offer URL
- Contract type: CDI, CDD, freelance, internship, apprenticeship or other
- Target annual salary or freelance daily rate (TJM)
- Application status and current recruitment stage
- Priority: high, medium or low
- Explicit next follow-up date
- Recruiter name, email and phone
- Free-form notes
- Interview tracking and browser reminders

### Pipeline management

- Search by company, position, recruiter, stage or notes
- Filter by status, contract type and priority
- Sort directly from table headers
- Highlight follow-ups that are due
- Open the original offer directly from the pipeline
- Detailed application view with compensation, recruiter and interview context

### Job-search cockpit

- Total applications
- Response rate
- Follow-ups requiring action
- Interviews scheduled in the next 14 days
- High-priority active pipeline
- Application-status distribution
- Weekly application activity

## Tech stack

- Angular 19
- TypeScript
- Angular Material
- RxJS
- Chart.js / ng2-charts
- Browser Local Storage
- GitHub Actions
- Netlify

## Architecture

```text
src/app
├── components
│   ├── dashboard
│   ├── job-form
│   └── job-list
├── models
│   └── job-application.model.ts
├── services
│   ├── notification.service.ts
│   └── storage.service.ts
└── app.component.ts
```

### State flow

```text
JobForm / JobList
       │
       ▼
StorageService
       │
       ├── Browser Local Storage
       │
       └── BehaviorSubject<JobApplication[]>
                    │
                    ├── JobList
                    └── Dashboard
```

`StorageService` owns the application collection and exposes immutable snapshots through RxJS. Persisted JSON is hydrated back into typed objects and date fields before publication.

The storage hydration layer also migrates legacy contact fields into the newer recruiter model and supplies safe defaults for contract type, priority, recruitment stage and compensation period, so existing browser data remains usable after product evolution.

Long-lived subscriptions use Angular's `takeUntilDestroyed` lifecycle integration.

## Follow-up logic

Explicit follow-up dates drive the cockpit. Active applications whose follow-up date is today or overdue are surfaced as actions.

For older records that do not yet have a follow-up date, JobTrackr keeps a compatibility rule: a sent application older than seven days is flagged as needing a follow-up plan.

Derived statistics and action suggestions are recalculated from application state instead of being persisted separately, avoiding synchronization problems.

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

Pull requests and pushes to the default branch are validated by GitHub Actions with a clean install and production Angular build.

```text
GitHub
  │
  ├── Pull Request
  │     ├── GitHub Actions production build
  │     └── Netlify Deploy Preview
  │
  └── master
        └── Netlify production deployment
```

## Engineering decisions

### Why local storage?

The current version remains intentionally frontend-only. It demonstrates application modeling, reactive state, persistence, migration of stored data and data visualization while keeping deployment lightweight.

### Why a dedicated storage service?

Components never manipulate browser storage directly. Persistence, hydration, migration, statistics and follow-up derivation are centralized behind `StorageService`, making an eventual HTTP-backed repository easier to introduce.

### Why separate Dashboard and Applications?

The Dashboard answers **“what should I do next?”**. The Applications page answers **“what is the complete state of each opportunity?”**. This avoids duplicating the same workflow across multiple pages.

## Current limitations

- Data is limited to the current browser/device
- No authentication or user accounts
- No server-side persistence
- Browser reminders depend on browser lifecycle and permissions
- No automated unit or end-to-end test suite yet

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
4. Unit/integration testing with Testcontainers
5. OpenAPI documentation
6. Import/export and backup of application data
7. Cloud deployment and observability
8. Optional Kafka event flow for notifications and follow-up events

The frontend is structured so browser persistence can later be replaced by an API-backed repository without redesigning the product model.
