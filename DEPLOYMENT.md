# JobTrackr production deployment

JobTrackr uses three deployment platforms:

```text
Browser
  ↓
Netlify · Angular
  ↓ /api reverse proxy
Render · Spring Boot
  ↓ TLS
Neon · PostgreSQL
```

The repository is a monorepo with the Angular application in `frontend/` and the Spring Boot API in `backend/`.

## 1. Neon PostgreSQL

Create a Neon project and keep these values outside the repository:

```text
DATABASE_HOST=ep-...eu-central-1.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=<generated Neon password>
```

Spring Boot assembles the production JDBC URL with TLS:

```text
jdbc:postgresql://${DATABASE_HOST}:5432/${DATABASE_NAME}?sslmode=require
```

HikariCP uses a deliberately small pool for the current low-traffic deployment. Flyway owns both business schema migrations and the `auth_session` table used for rotating refresh sessions.

## 2. Render backend

Create a Render Blueprint from the repository-root `render.yaml`.

The Blueprint provisions the `jobtrackr-api` web service and expects the Neon variables to be supplied as environment variables. Production secrets such as `JWT_SECRET` and the database password must never be committed.

The health endpoint is:

```text
/actuator/health
```

Render Free can sleep when idle, so the first request after inactivity may be slower.

Production auth defaults are:

```text
access JWT cookie: 15 minutes
refresh session:    30 days
```

The access JWT is signed with `JWT_SECRET`. Refresh credentials are random opaque values; only their SHA-256 hash is stored in PostgreSQL. Refreshing rotates the credential and replay of an older refresh credential revokes the session.

## 3. Netlify frontend

The root `netlify.toml` declares:

```toml
[build]
  base = "frontend"
  command = "npm run build:netlify"
  publish = "dist/demo/browser"
```

Configure:

```text
JOBTRACKR_API_ORIGIN=https://<service>.onrender.com
```

Use the HTTPS origin only, without `/api` or a trailing path.

The frontend build generates:

```text
/api/*  https://<service>.onrender.com/api/:splat  200
/*      /index.html                               200
```

The first rule keeps browser API calls same-origin through Netlify. This is important for the cookie + XSRF browser-auth contract. The second rule preserves Angular client-side routing.

## 4. Browser authentication contract

Browser authentication is cookie-only:

```text
jobtrackr_session
  HttpOnly
  Secure in production
  SameSite=Strict
  Path=/api
  TTL=15 minutes

jobtrackr_refresh
  HttpOnly
  Secure in production
  SameSite=Strict
  Path=/api/v1/auth
  rotating session TTL=30 days

XSRF-TOKEN
  readable by Angular
  Secure in production
  SameSite=Strict
  Path=/
```

Angular sends `X-XSRF-TOKEN` on unsafe same-origin requests. Business mutations and logout require a valid CSRF token. Login, registration and refresh are deliberately CSRF-exempt so a session can be established or renewed.

The browser never reads, stores or attaches the access JWT. `localStorage` contains only non-sensitive session metadata (`expiresAt`, `sessionExpiresAt`, user identity) used for UI state. Explicit non-browser API clients may still use `Authorization: Bearer ...`; they are handled by a separate Spring Security filter chain and do not rely on ambient cookies.

## 5. Refresh flow

When a protected request returns `401` because the 15-minute access cookie expired:

```text
Angular request
  ↓ 401
POST /api/v1/auth/refresh
  ↓ refresh cookie validated + rotated
new access cookie + new refresh cookie
  ↓
original request retried once
```

Angular shares one in-flight refresh request, preventing multiple simultaneous `401` responses from causing a refresh storm. If refresh fails, local session metadata is cleared and the user returns to the account screen.

## 6. Safe deployment order

Authentication protocol changes must be deployed using an expand → migrate → contract sequence rather than assuming Netlify and Render update at exactly the same time.

```text
A. Backend expands contract while remaining backward-compatible
B. Frontend migrates to the new contract
C. Backend enforces the new security contract
D. Legacy browser compatibility code is removed
```

During future distributed or Kubernetes rollouts, keep version N compatible with N-1 across the deployment window whenever an API contract changes.

## 7. Smoke test

After deployment:

1. Verify the backend health endpoint reports `UP`.
2. Verify `GET /api/v1/auth/capabilities` reports `cookie-refresh-csrf-v1` and `csrfEnforced=true`.
3. Open the Netlify application and register a test account.
4. Sign out and sign in again.
5. Confirm browser storage contains metadata only and no credential.
6. Create a fictional application and verify the mutation succeeds through XSRF protection.
7. Move it in Kanban and refresh; the stage must remain persisted.
8. Add or edit an interview and refresh.
9. Set and complete a follow-up.
10. Leave the application open long enough for an access-token refresh in a non-production test configuration, or exercise `/auth/refresh` in integration tests.
11. Export a backup, review an import preview, then import non-sensitive test data.
12. Confirm another browser session sees the same account data.

JobTrackr is cloud-only for business data. There is no anonymous/local application-data mode or application-data LocalStorage fallback.

## 8. CORS and domains

`render.yaml` keeps an explicit frontend origin allow-list for direct API diagnostics. Normal browser traffic uses the Netlify `/api` proxy.

When adding a custom frontend domain, add its exact HTTPS origin to `CORS_ALLOWED_ORIGINS` on Render and redeploy.

## 9. Secrets

Never commit:

- Neon database passwords
- `JWT_SECRET`
- provider API tokens
- OAuth client secrets

Rotating `JWT_SECRET` invalidates current access JWTs. Existing refresh sessions can then issue fresh access JWTs after deployment, provided their server-side session has not expired or been revoked. Rotating the Neon password requires updating the Render environment variable and redeploying.

## 10. Scaling notes

The access-token path is stateless: any Spring instance can validate the signed access JWT, so application requests do not require sticky sessions. Refresh-session state lives in PostgreSQL and is shared across instances.

The current request-rate limiter is intentionally lightweight and in-process. Before running multiple backend replicas under meaningful traffic, replace that implementation with a shared limiter such as Redis or an API-gateway/load-balancer quota. The job-import bulkhead is likewise per JVM; global egress concurrency belongs at the platform layer once multiple replicas are introduced.

## 11. Rollback

Frontend:

- restore a prior successful Netlify deploy that is compatible with the currently deployed backend contract.

Backend:

- redeploy a previous healthy commit from Render deploy history only if its API/auth contract remains compatible with the frontend currently served by Netlify.

Database:

- Flyway owns schema changes. Code rollback does not undo an applied migration, so schema migrations must remain backward-compatible or include an explicit recovery procedure.

## 12. CI checks

Every pull request validates the deployable system.

Frontend checks run from `frontend/`:

```text
npm audit --omit=dev
Angular/Vitest tests
browser-auth credential boundary guard
Netlify production build
/api proxy rule
SPA fallback rule
```

Backend checks run from `backend/`:

```text
Maven verify
PostgreSQL Testcontainers integration tests
refresh rotation + replay protection
cookie/XSRF negative and positive cases
Bearer API compatibility
production Docker image build
Render + Neon blueprint guard
```

Render uses `autoDeployTrigger: checksPass`, so backend deployment waits for repository checks.
