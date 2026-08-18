# JobTrackr Backend

Spring Boot API for the cloud/multi-user JobTrackr V1.

## Stack

- Java 21
- Spring Boot 4.1
- Spring Web MVC
- Spring Security
- JWT bearer authentication
- Spring Data JPA / Hibernate
- PostgreSQL
- Flyway
- Actuator
- Testcontainers

## Run locally

Start PostgreSQL from the repository root:

```bash
docker compose -f backend/compose.yml up -d
```

Run the API:

```bash
cd backend
mvn spring-boot:run
```

The API listens on `http://localhost:8080` by default.

Health endpoint:

```text
GET /actuator/health
```

## Environment variables

Development defaults are defined in `application.yml`. Production uses the `production` Spring profile and requires explicit database credentials.

| Variable | Development default | Production purpose |
| --- | --- | --- |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/jobtrackr` | Generic local/default JDBC URL outside the production profile |
| `DATABASE_HOST` | — | Production PostgreSQL hostname (Neon endpoint) |
| `DATABASE_PORT` | `5432` | Production PostgreSQL port |
| `DATABASE_NAME` | — | Production database name |
| `DATABASE_USERNAME` | `jobtrackr` locally | Production database role |
| `DATABASE_PASSWORD` | `jobtrackr` locally | Production database password |
| `JWT_SECRET` | development-only value | HMAC signing secret; replace in every deployed environment |
| `JWT_TTL` | `PT12H` | Access-token lifetime |
| `CORS_ALLOWED_ORIGINS` | localhost Angular/Vite origins | Comma-separated SPA origins |
| `PORT` | `8080` | HTTP port |

`JWT_SECRET` must be at least 32 bytes and must be supplied through a secret manager in production.

For the free portfolio deployment, Render runs the Docker image and Neon hosts PostgreSQL. `application-production.yml` assembles the Neon JDBC URL with `sslmode=require` and uses a small Hikari pool (`maximumPoolSize=5`, `minimumIdle=0`) suitable for an intermittent, scale-to-zero database workload.

See the repository-root `DEPLOYMENT.md` for the Render + Neon + Netlify setup.

## API

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

Interviews:

```text
POST   /api/v1/applications/{id}/interviews
PUT    /api/v1/applications/{id}/interviews/{interviewId}
DELETE /api/v1/applications/{id}/interviews/{interviewId}
```

Migration, backup and follow-ups:

```text
POST /api/v1/applications/import
GET  /api/v1/applications/export
GET  /api/v1/applications/follow-ups/due
```

All `/api/v1/**` endpoints except registration and login require:

```text
Authorization: Bearer <access-token>
```

## Tenant isolation

The authenticated JWT subject contains the server-side user UUID. Controllers never accept a `userId` from application payloads. Every application lookup is scoped by both resource id and authenticated owner id.

This prevents a user from accessing another user's application by guessing a UUID.

## Workflow invariant

Recruitment stage remains the source of truth, matching the Angular frontend:

```text
Candidature -> Envoyé
Screening RH / Entretien technique / Hiring Manager / Entretien final -> Entretien
Offre -> Accepté
Clôturé -> Refusé
```

The backend derives status from stage instead of trusting contradictory client payloads.

## Database migrations

Flyway migrations live under:

```text
src/main/resources/db/migration
```

Hibernate runs with `ddl-auto=validate`, so schema changes must be explicit Flyway migrations.

## Tests

```bash
cd backend
mvn verify
```

Integration tests use a real PostgreSQL Testcontainer and verify authentication, profile persistence, application behavior, interview replacement and cross-user data isolation.
