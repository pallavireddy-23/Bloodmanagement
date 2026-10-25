# Verification — 25 October 2026

Verified in the cloud workspace:

- Frozen installation: `npm ci --cache /tmp/bloodflow-npm --no-audit --no-fund` succeeded.
- `npm test`: 10 database tests passed, 0 failed, 0 skipped.
- `npm run test:ui`: 4 Chromium workflow tests passed, 0 failed, 0 skipped.
- `npm run build`: succeeded with Vite 7.3.7.
- `npm audit --audit-level=low`: 0 reported vulnerabilities at verification time.
- Production output served through Vite preview; login and sample dashboard rendered without browser errors. Desktop/mobile screenshots are included in the delivery folder.

The database tests execute the shipped PostgreSQL schema in PGlite with minimal Auth tables and authenticated-identity function shims. They test SQL permissions, constraints and workflows; they do not run the Supabase Auth service or simultaneous PostgreSQL connections.

The owner has supplied their project URL and public publishable key; `.env.local` is configured and a new production build embeds those public settings. The cloud proxy returned CONNECT 403 for a read-only schema check, so table availability and key validity could not be confirmed. The exact project hostname and public variable requirements were saved in the environment draft.

Not yet verified: live schema and demo data, live authentication/password policy, optional phone/email same-account login, simultaneous multi-connection reservations, shared state on two devices, and deployed Cloudflare Pages behaviour. See ACCEPTANCE.md for the exact remaining checks. No website has been published or code pushed to GitHub from this workspace.

Cloud onboarding install_script and start_skill were saved to the configuration draft. They were not published; the owner must review/save settings and publish the environment to retain reusable cloud configuration. This is separate from website deployment.

## Live setup follow-up

The owner reported success running the combined schema and fictional seed script and provided a SQL Editor success screenshot. A subsequent HTTPS request to Supabase Auth settings returned 200 with the public key. Anonymous profiles access returned 401 / PostgreSQL 42501 (permission denied), confirming anonymous access is blocked. Email login is enabled; phone login is disabled. Public sign-up is currently enabled and email autoconfirm is disabled; configure the closed-demo Auth settings before deployment. No app account or authenticated stock workflow has yet been verified.
