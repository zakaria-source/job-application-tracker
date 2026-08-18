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

The application uses HikariCP with a small pool suitable for the current low-traffic deployment. Flyway runs through the same datasource.

## 2. Render backend

Create a Render Blueprint from the repository-root `render.yaml`.

The Blueprint provisions the `jobtrackr-api` web service and expects the Neon variables to be supplied as environment variables. Production secrets such as `JWT_SECRET` and the database password must never be committed.

The health endpoint is:

```text
/actuator/health
```

Render Free can sleep when idle, so the first request after inactivity may be slower.

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

The first rule keeps browser API calls same-origin through Netlify. The second preserves Angular client-side routing.

## 4. Smoke test

After deployment:

1. Verify `GET https://<service>.onrender.com/actuator/health` returns `UP`.
2. Open the Netlify application.
3. Register a test account.
4. Sign out and sign in again.
5. Create a fictional application.
6. Move it in Kanban and refresh; the stage must remain persisted.
7. Add or edit an interview and refresh.
8. Set and complete a follow-up.
9. Export a backup, review an import preview, then import non-sensitive test data.
10. Confirm another browser session sees the same account data.

JobTrackr is cloud-only for business data. There is no anonymous/local application-data mode or LocalStorage fallback. Browser storage is used only for the current authentication session token.

## 5. CORS and domains

`render.yaml` keeps an explicit frontend origin allow-list for direct API diagnostics. Normal browser traffic uses the Netlify `/api` proxy.

When adding a custom frontend domain, add its exact HTTPS origin to `CORS_ALLOWED_ORIGINS` on Render and redeploy.

## 6. Secrets

Never commit:

- Neon database passwords
- `JWT_SECRET`
- provider API tokens
- OAuth client secrets

Rotating `JWT_SECRET` invalidates existing access tokens. Rotating the Neon password requires updating the Render environment variable and redeploying.

## 7. Rollback

Frontend:

- restore a prior successful Netlify deploy.

Backend:

- redeploy a previous healthy commit from Render deploy history.

Database:

- Flyway owns schema changes. Code rollback does not undo an applied migration, so schema migrations should remain backward-compatible or include an explicit recovery procedure.

## 8. CI checks

Every pull request validates the deployable system.

Frontend checks run from `frontend/`:

```text
npm audit --omit=dev
Angular/Vitest tests
Netlify production build
/api proxy rule
SPA fallback rule
```

Backend checks run from `backend/`:

```text
Maven verify
PostgreSQL Testcontainers integration tests
production Docker image build
Render + Neon blueprint guard
```

Render uses `autoDeployTrigger: checksPass`, so backend deployment waits for repository checks.
