# JobTrackr production deployment

JobTrackr uses a three-platform deployment that keeps the portfolio baseline at $0 under the providers' current free plans:

```text
Browser
  |
  v
Netlify (Angular)
  |
  | /api/* reverse proxy
  v
Render Free Web Service (Spring Boot)
  |
  | TLS PostgreSQL connection
  v
Neon Free Postgres
```

## Zero-cost portfolio baseline

- Netlify: existing Angular frontend
- Render web service: `free`, region Frankfurt
- Neon Postgres: Free plan, preferably AWS Europe (Frankfurt / `aws-eu-central-1`)
- backend auto-deploy: only after repository checks pass
- generated 256-bit `JWT_SECRET`
- API health check: `/actuator/health`
- Neon connection requires TLS (`sslmode=require`)
- Hikari pool is intentionally small (`max=5`, `minimumIdle=0`) so an idle portfolio does not keep unnecessary database connections alive

Provider free-plan limits and pricing can change. This configuration is a zero-cost baseline under the current plans, not a contractual guarantee that either provider will remain free forever.

Render Free is appropriate for a portfolio/demo workload but can spin down when idle and is subject to monthly free-instance, bandwidth and build limits. Neon Free scales database compute to zero after inactivity and is designed for intermittent workloads.

## 1. Create the Neon database

1. Create or sign in to a Neon account.
2. Create a project named `jobtrackr` on the Free plan.
3. Choose AWS Europe (Frankfurt / `aws-eu-central-1`) when available so the database is close to the Render Frankfurt service.
4. Keep the default production branch.
5. In **Connect**, use a **direct / unpooled** PostgreSQL connection for the Spring Boot service. The application already uses HikariCP, and Flyway runs through the same datasource.
6. Copy these values from the Neon connection details:

```text
DATABASE_HOST=ep-...eu-central-1.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=<generated Neon password>
```

Do not commit any of these credentials.

The production JDBC URL is assembled by Spring Boot as:

```text
jdbc:postgresql://${DATABASE_HOST}:5432/${DATABASE_NAME}?sslmode=require
```

## 2. Deploy the Spring Boot API on Render

1. In Render, create a new **Blueprint** from this GitHub repository.
2. Use the repository-root `render.yaml`.
3. The Blueprint creates only one resource: the Free `jobtrackr-api` web service. It does **not** create a Render database.
4. During the initial Blueprint creation, Render prompts for the `sync: false` variables. Paste the Neon values for:

```text
DATABASE_HOST
DATABASE_NAME
DATABASE_USERNAME
DATABASE_PASSWORD
```

5. Apply the Blueprint.
6. Wait for `/actuator/health` to report healthy.
7. Copy the API HTTPS origin, for example:

```text
https://jobtrackr-api.onrender.com
```

Render generates `JWT_SECRET` automatically. The secret is not stored in GitHub.

### Render Free behavior

A Free web service can sleep when idle. The first request after a quiet period can therefore be slower while Render wakes the backend. Neon may also need to wake its compute after inactivity. This cold-start behavior is acceptable for the portfolio/free baseline.

If the project later needs consistent low latency, upgrade only the bottleneck that matters; the application architecture does not require a migration away from Neon.

## 3. Connect Netlify to Render

In the existing Netlify site, add:

```text
JOBTRACKR_API_ORIGIN=https://<service>.onrender.com
```

Use only the HTTPS origin, with no trailing `/api`, query string, credentials or fragment.

Trigger a Netlify deploy. `npm run build:netlify` generates:

```text
/api/*  https://<service>.onrender.com/api/:splat  200
/*      /index.html                               200
```

The API rule keeps browser requests same-origin while Netlify proxies them to Render. The fallback preserves Angular client-side routing.

If `JOBTRACKR_API_ORIGIN` is absent, the build still succeeds and writes only the SPA fallback. Local-only JobTrackr therefore remains usable even before the cloud backend is connected.

## 4. Smoke test

After Neon, Render and Netlify are connected:

1. `GET https://<service>.onrender.com/actuator/health` returns `UP`.
2. Open the Netlify frontend and confirm anonymous/local mode still works.
3. Create a new cloud account from `/account`.
4. Sign out and sign in again.
5. Create a fictional test application.
6. Move it in Kanban and refresh; the stage remains persisted.
7. Add/edit an interview and refresh.
8. Sign out; the untouched LocalStorage workspace reappears.
9. Sign back in and explicitly test **Importer mes données locales** with non-sensitive test data first.

## 5. CORS and custom domains

`render.yaml` currently allows:

```text
https://trackmyjob-zakaria.netlify.app
```

Normal API calls use the Netlify same-origin proxy, but keeping the backend CORS allow list explicit is useful for direct API diagnostics.

When a custom frontend domain is introduced, add its exact HTTPS origin to `CORS_ALLOWED_ORIGINS` on Render and redeploy.

## 6. Secrets

Never commit:

- Neon database password
- `JWT_SECRET`
- provider API tokens
- future OAuth client secrets

Render generates the JWT secret. Neon owns the database password.

Rotating `JWT_SECRET` invalidates existing access tokens. Rotating the Neon database password requires updating `DATABASE_PASSWORD` in Render and redeploying.

## 7. Neon Free considerations

Neon Free automatically scales inactive compute to zero. The production datasource therefore uses:

```yaml
hikari:
  maximum-pool-size: 5
  minimum-idle: 0
  idle-timeout: 30000
```

This is intentional for a low-traffic portfolio workload.

The application uses the direct Neon endpoint rather than the Neon PgBouncer endpoint because HikariCP already provides application-side pooling and Flyway shares the datasource. If traffic grows substantially, revisit pooling based on measured connection pressure.

## 8. Rollback

Frontend:

- restore a prior successful Netlify deploy.

Backend:

- redeploy a previous healthy commit from Render deploy history.

Database:

- Flyway owns schema changes. A code rollback does not automatically undo an applied migration, so future migrations should remain backward-compatible or include an explicit recovery procedure.

## CI deployment checks

Every pull request validates deployable artifacts:

```text
Frontend
  npm audit --omit=dev
  Angular/Vitest tests
  Netlify production build
  generated /api proxy rule
  SPA fallback rule

Backend
  Maven verify
  PostgreSQL Testcontainers integration tests
  production Docker image build
```

Render uses `autoDeployTrigger: checksPass`, so deployment waits for repository checks.
