# JobTrackr

JobTrackr is a simple workspace for tracking job applications, follow-ups and interviews.

**Live app:** https://trackmyjob-zakaria.netlify.app/

## Features

- application tracking with list and Kanban views
- recruitment stages, priorities and follow-up dates
- recruiter and interview tracking
- dashboard with upcoming actions and pipeline metrics
- JSON import/export
- local mode without an account
- optional cloud account with synchronized data

## How it works

```text
Local mode
Browser
  ↓
Angular
  ↓
LocalStorage

Cloud mode
Browser
  ↓
Netlify · Angular
  ↓ /api
Render · Spring Boot
  ↓
Neon · PostgreSQL
```

Signing in does not automatically upload data already stored in the browser. Local data is imported into a cloud account only when the user explicitly chooses to do so.

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

Start Angular from the repository root:

```bash
npm ci
npm start
```

Open `http://localhost:4200`.

## Tests

Frontend:

```bash
npm run test:ci
npm run build -- --configuration production
```

Backend:

```bash
mvn -B -f backend/pom.xml verify
```

Backend integration tests use PostgreSQL Testcontainers.

## Security and privacy

- passwords are hashed with BCrypt
- API access uses bearer JWT authentication
- application data is scoped to the authenticated user
- production database connections use TLS
- production secrets stay outside the repository
- local browser data is never silently uploaded

## Deployment

Production uses Netlify for the frontend, Render for the Spring Boot API and Neon for PostgreSQL.

Deployment details, environment variables, smoke tests and rollback notes are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).
