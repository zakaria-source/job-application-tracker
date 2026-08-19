# JobTrackr Backend

Spring Boot API for the cloud/multi-user JobTrackr application.

## Stack

- Java 21
- Spring Boot 4.1
- Spring Web MVC
- Spring Security
- short-lived JWT access tokens
- rotating, revocable refresh sessions
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
| `JWT_TTL` | `PT15M` | Access-token lifetime |
| `REFRESH_TTL` | `P30D` | Rotating refresh-session lifetime |
| `CORS_ALLOWED_ORIGINS` | localhost Angular/Vite origins | Comma-separated SPA origins |
| `PORT` | `8080` | HTTP port |

`JWT_SECRET` must be at least 32 bytes and must be supplied through a secret manager in production.

For the free portfolio deployment, Render runs the Docker image and Neon hosts PostgreSQL. `application-production.yml` assembles the Neon JDBC URL with `sslmode=require` and uses a small Hikari pool (`maximumPoolSize=5`, `minimumIdle=0`).

See the repository-root `DEPLOYMENT.md` for the complete Render + Neon + Netlify setup and rolling-deployment rules.

## Authentication

Browser authentication uses two HttpOnly cookies:

```text
jobtrackr_session   access JWT, 15 minutes, Path=/api
jobtrackr_refresh   opaque rotating refresh credential, 30 days, Path=/api/v1/auth
```

Both are `Secure` in production and `SameSite=Strict`. Only a SHA-256 hash of the refresh credential is persisted in PostgreSQL. Every successful refresh rotates the credential. Reuse of an older refresh credential is treated as replay and revokes the session.

Browser mutations use Angular/Spring's synchronizer-token pattern:

```text
Cookie: XSRF-TOKEN
Header: X-XSRF-TOKEN
```

Cookie-authenticated `POST`, `PUT`, `PATCH`, `DELETE` operations require CSRF protection, with login/register/refresh as the deliberate establishment exceptions.

Explicit non-browser API clients can still authenticate with:

```text
Authorization: Bearer <access-jwt>
```

Bearer-header clients are handled by a separate Spring Security filter chain. Browser cookie JWTs use a dedicated authentication filter so they remain subject to CSRF protection.

Authentication endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/csrf
GET  /api/v1/auth/capabilities
GET  /api/v1/auth/me
```

The login/register/refresh JSON contains expiry metadata and user information only; credentials are never returned in the response body.

## API

Profile:

```text
GET /api/v1/profile
PUT /api/v1/profile
```

Applications:

```text
GET    /api/v1/applications
POST   /api/v1/applications
PUT    /api/v1/applications/{id}
PATCH  /api/v1/applications/{id}/stage
DELETE /api/v1/applications/{id}
POST   /api/v1/applications/import
```

Advanced tracking is exposed below `/api/v1/applications/{applicationId}` for activity, follow-ups, debriefs, health and tracking overview.

Job-offer preview import is exposed through:

```text
POST /api/v1/job-import/preview
```

It validates public HTTPS destinations, limits response size and redirects, applies per-user throttling, and uses a bounded in-process concurrency bulkhead.

## Tenant isolation

The authenticated JWT subject contains the server-side user UUID. Controllers never accept a `userId` from application payloads. Every application lookup is scoped by both resource id and authenticated owner id.

This prevents a user from accessing another user's application by guessing a UUID.

## Database migrations

Flyway migrations live under:

```text
src/main/resources/db/migration
```

`V3__auth_sessions.sql` adds the shared refresh-session store. Hibernate runs with `ddl-auto=validate`, so schema changes must be explicit Flyway migrations.

## Scaling model

Access-token validation is stateless, so any backend replica can serve an authenticated business request without sticky sessions. Refresh-session state is shared through PostgreSQL.

The current rate limiter and external-import bulkhead are per JVM. They are appropriate for the present single-instance deployment; move quotas/concurrency coordination to Redis or an API gateway when operating multiple replicas under meaningful traffic.

## Tests

```bash
cd backend
mvn verify
```

Integration tests use real PostgreSQL Testcontainers and verify, among other things:

- cross-user data isolation
- optimistic concurrency
- refresh-token rotation
- refresh-token replay revocation
- cookie authentication
- CSRF rejection without XSRF
- successful cookie mutation with valid XSRF
- explicit Bearer API compatibility
- CSRF-protected logout and refresh revocation
