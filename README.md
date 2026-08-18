# JobTrackr

JobTrackr is a simple cloud workspace for tracking job applications, follow-ups and interviews.

**Live app:** https://trackmyjob-zakaria.netlify.app/

## Features

- account-based workspace
- application tracking with list and Kanban views
- recruitment stages, priorities and follow-up dates
- recruiter and interview tracking
- dashboard with upcoming actions and pipeline metrics
- JSON import/export
- synchronized data across devices

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

JobTrackr requires an account. Profile and application data are stored through the backend API and PostgreSQL; there is no LocalStorage data mode.

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

Open `http://localhost:4200`, create an account, then use the application through the local backend.

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
- profile and application data are scoped to the authenticated user
- production database connections use TLS
- production secrets stay outside the repository
- business data is persisted in PostgreSQL, not browser LocalStorage

## Deployment

Production uses Netlify for the frontend, Render for the Spring Boot API and Neon for PostgreSQL.

Deployment details, environment variables, smoke tests and rollback notes are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).
