# JobTrackr

JobTrackr is an Angular application for tracking job applications, follow-ups, responses and interviews from a single dashboard.

**Live demo:** https://trackmyjob-zakaria.netlify.app/

## Product scope

The application is intentionally focused on two clear areas:

- **Dashboard** — understand the current state of the job search, identify follow-ups and see upcoming interviews.
- **Applications** — create, search, filter, inspect, edit and delete job applications.

Keeping these responsibilities separate avoids duplicated user journeys and makes the interface easier to understand.

## Features

- Create, update and delete job applications
- Search applications by company, position or notes
- Filter applications by status
- Sort directly from table columns
- Track application status: sent, interview, accepted or rejected
- Store recruiter/contact information
- Track interviews and reminders
- Persist application data in browser local storage
- Dashboard statistics and application trends
- Response-rate and average-response-time calculation
- Weekly application activity
- Most responsive companies ranking
- Follow-up suggestions for applications without a response
- Upcoming interview agenda
- Responsive Angular Material interface

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

`StorageService` owns the application collection and exposes immutable snapshots through RxJS. Stored JSON is hydrated back into typed application objects, including `Date` values, before being published to the UI.

Subscriptions in long-lived components use Angular's `takeUntilDestroyed` lifecycle integration so they are disposed automatically.

## Dashboard responsibilities

The dashboard deliberately avoids reproducing the full applications page. It focuses on information that helps decide what to do next:

- total applications
- response rate
- average response time
- follow-ups currently due
- application status distribution
- application activity over time
- company response-time comparison
- upcoming interviews

Interview events are shown in the agenda rather than duplicated again as generic suggestions.

## Application management

The Applications view is the single workspace for application operations:

- add a new application
- filter and search
- sort using table headers
- inspect application details
- edit an application
- delete an application
- manage associated interviews

The UI distinguishes between an empty tracker and a filter returning no results, so each state presents the appropriate action.

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

This keeps production deployment separate from feature validation: changes can be checked through a Netlify preview before being merged.

## Engineering decisions

### Why local storage?

The current version is intentionally frontend-only. This keeps deployment simple while demonstrating Angular component design, reactive state, persistence and data visualization.

### Why a dedicated storage service?

Components do not manipulate browser storage directly. Persistence and application state are centralized behind `StorageService`, making a future replacement with an HTTP repository considerably easier.

### Why derived dashboard statistics?

Statistics and suggestions are calculated from the application state rather than persisted separately. This avoids synchronization problems between stored applications and derived analytics.

## Current limitations

- Data is limited to the current browser/device
- No authentication or user accounts
- No server-side persistence
- Browser notifications are limited by browser lifecycle and permissions
- No automated unit or end-to-end test suite yet

## Roadmap

A natural backend evolution would turn the project into a full-stack application:

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

Potential additions:

1. Spring Boot REST API
2. PostgreSQL persistence
3. Authentication with Spring Security and OAuth2/OIDC
4. Docker Compose development environment
5. Unit and integration tests with Testcontainers
6. OpenAPI API documentation
7. Import/export of application data
8. Cloud deployment and observability
9. Optional Kafka-based notification/event workflow

The frontend is structured so the browser persistence layer can eventually be replaced by an API-backed repository without redesigning the entire UI.
