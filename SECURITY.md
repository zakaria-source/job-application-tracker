# Security Policy

## Supported version

JobTrackr is an actively maintained portfolio project. Security fixes are applied to the default branch.

## Reporting a vulnerability

Please do not open a public GitHub issue for suspected vulnerabilities involving authentication, authorization, OAuth credentials, session handling, CSRF, personal data, or secrets.

Use GitHub's private vulnerability reporting feature when available. Include:

- the affected component and endpoint or workflow;
- clear reproduction steps;
- expected and observed behavior;
- impact assessment;
- any proposed remediation, if known.

Please avoid accessing, modifying, or retaining data that does not belong to you while validating a report.

## Security design

The application uses short-lived access sessions, rotating refresh sessions, CSRF protection for browser mutations, encrypted Gmail refresh tokens, per-user data scoping, TLS-backed production database connections, and secret-free repository configuration.

See the main README and `DEPLOYMENT.md` for architecture and operational details.
