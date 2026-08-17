# JobTrackr

JobTrackr is a lightweight job-application tracking dashboard built with **Angular 19**, **Angular Material**, **RxJS** and **Chart.js**.

It helps candidates centralize applications, monitor response rates, identify follow-ups and keep upcoming interviews visible from one dashboard.

**Live demo:** https://trackmyjob-zakaria.netlify.app/

## Why this project exists

Job searches quickly become difficult to manage across spreadsheets, emails and job boards. JobTrackr turns that workflow into a small product with a clear domain model, reactive state and useful analytics while remaining simple enough to run entirely in the browser.

## Product highlights

- Create, edit and delete job applications
- Track application status: sent, interview, accepted or rejected
- Store recruiter/contact information and application notes
- Manage interviews and optional browser reminders
- Search, filter, sort and paginate applications
- Persist data in browser local storage
- Calculate response rate and average response time
- Visualize weekly application activity and status distribution
- Rank the most responsive companies
- Suggest follow-ups for applications without a response
- Surface interviews scheduled in the next 14 days

## Engineering highlights

- **Standalone Angular components** with a small, explicit component hierarchy
- **Reactive application state** backed by RxJS `BehaviorSubject`
- **Lifecycle-safe dashboard subscriptions** using `takeUntilDestroyed`
- **Immutable state updates** before publishing new application snapshots
- **Local-storage hydration** that restores serialized dates into domain objects
- **Derived analytics** kept in the storage/domain service instead of duplicated in UI components
- **Responsive Angular Material UI** with Chart.js visualizations
- **Continuous integration** that runs a clean production build on every pull request and on `master`
- **Reproducible Node setup** through `.nvmrc`

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Angular 19, TypeScript |
| UI | Angular Material |
| Reactive state | RxJS |
| Charts | Chart.js, ng2-charts |
| Persistence | Browser Local Storage |
| Hosting | Netlify |
| CI | GitHub Actions |

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

### Main responsibilities

- `JobFormComponent` owns application/interview form validation and emits domain objects.
- `JobListComponent` provides application discovery and CRUD interactions.
- `DashboardComponent` derives a live view from application state and time-based refresh signals.
- `StorageService` is the client-side source of truth: persistence, hydration, statistics and recommendations.
- `NotificationService` handles browser notification reminders.

## Data flow

```text
User action
   │
   ▼
Angular component
   │
   ▼
StorageService ─────► Local Storage
   │
   ▼
BehaviorSubject<JobApplication[]>
   │
   ├────────► Job list
   └────────► Dashboard / analytics / suggestions
```

The UI does not read local storage directly. State changes go through `StorageService`, which persists the new state and publishes a fresh array to subscribers.

## Run locally

### Prerequisites

- Node.js 20
- npm

```bash
git clone https://github.com/zakaria-source/job-application-tracker.git
cd job-application-tracker
npm ci
npm start
```

Then open `http://localhost:4200`.

## Production build

```bash
npm run build -- --configuration production
```

The same command is executed by the GitHub Actions CI workflow.

## Current scope and trade-offs

JobTrackr is intentionally frontend-only. This keeps deployment friction low and makes the project usable without an account, but it also means data is tied to one browser and browser notifications are best-effort rather than durable scheduled jobs.

Those constraints are explicit rather than hidden: they define the boundary for the next architectural iteration.

## Roadmap

The next version is intended to evolve the project into a cloud-backed application:

1. **Spring Boot REST API** for application and interview management
2. **PostgreSQL** persistence with schema migrations
3. **Authentication and authorization** with OAuth2/OIDC
4. **Containerization** with Docker and deployment to Kubernetes or a managed cloud runtime
5. **Durable reminders** through backend scheduling and event-driven notifications
6. **Automated tests** for domain statistics, persistence and critical UI flows
7. **Import/export** for existing spreadsheet-based job searches

This roadmap deliberately turns the current Angular product into a full-stack system without discarding the existing domain model and frontend.
