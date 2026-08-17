# JobTrackr

A lightweight job-application tracking dashboard built with **Angular 19**, **Angular Material**, **RxJS** and **Chart.js**.

It helps candidates organize applications, monitor outcomes and identify when a follow-up or interview needs attention.

**Live demo:** https://trackmyjob-zakaria.netlify.app/

## Features

- Create, update and delete job applications
- Track application status: sent, interview, accepted or rejected
- Persist application data in browser local storage
- Dashboard statistics and application trends
- Response-rate and average-response-time calculation
- Weekly application activity
- Most responsive companies ranking
- Follow-up suggestions for applications without a response
- Upcoming interview reminders
- Reactive state management with RxJS `BehaviorSubject`

## Tech Stack

- Angular 19
- TypeScript
- Angular Material
- RxJS
- Chart.js / ng2-charts
- Browser Local Storage
- Netlify

## Architecture

```text
src/app
├── components
│   ├── dashboard
│   ├── job-form
│   └── job-list
├── models
├── services
│   ├── notification.service.ts
│   └── storage.service.ts
└── app.component.ts
```

The application separates UI components, domain models and persistence/notification services. `StorageService` owns application state and exposes it reactively to the UI.

## Run Locally

```bash
npm install
npm start
```

Then open `http://localhost:4200`.

## Build

```bash
npm run build
```

## Project Scope

JobTrackr is intentionally frontend-only. Data is stored locally in the browser, which keeps the project simple to deploy while demonstrating component design, reactive state, data visualization and client-side persistence.

A natural next evolution would be a Spring Boot API with PostgreSQL, authentication and cloud deployment.
