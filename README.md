# BloodFlow

A blood-bank administrative classroom project built from `BloodFlow_DBMS_Project_Brief.docx`. Responsive browser interface, Supabase Auth, and PostgreSQL with role permissions and transactional stock allocation. Single bank; packed red cells only; fictional data.

**Start here:** [Beginner setup guide](docs/START_HERE.md).

## What is implemented

- Email or international mobile + password login through Supabase, show password, logout, session handling and password change with live validation.
- Administrator, staff and requester interfaces; database-enforced access independently of the interface.
- Donor registration and donation history. New units enter quarantine; staff record screening decisions.
- Request submission, staff compatibility approval, earliest-expiry reservation, issue and cancellation.
- Request/unit locks, a unique live-allocation index, all-or-nothing reservation, repeat-action protection and expiry rechecks.
- Usable stock totals, low-stock thresholds, configurable expiry alerts and immutable client-facing audit history.
- Administrator account roles, registered users, distinct sign-ins today (Asia/Kolkata) and recent activity.
- A clearly labelled, disposable browser sample mode. This is a UI demonstration, **not** shared persistence, authentication, or a substitute for the PostgreSQL backend.

## Development in the cloud workspace

Node 22.12+ or Node 24; no developer database installation is needed for the embedded PostgreSQL tests.

```sh
cd /workspace/Bloodmanagement
npm ci --cache /tmp/bloodflow-npm
npm test
npm run build
npm run dev -- --port 5173
```

Open the app using a supported development environment's access mechanism. At the login screen choose **Explore sample workspace**. In the onboarding UI, localhost links are unsupported; validation uses internal browser requests instead.

For shared mode, apply the SQL files to Supabase as explained in the beginner guide. Either enter the public URL and publishable/anon key in the connection form or copy `.env.example` to `.env.local` and set the two public values. Environment values are embedded during the build. Never use a service-role or secret key in a `VITE_` variable. Changing keys in a deployed build requires rebuilding it; a connection saved in the browser is used only when build-time values are absent.

```sh
npm run test:ui
```

Browser tests expect `/usr/bin/chromium`. Set `CHROMIUM_PATH` to another installed Chromium executable when needed. Tests start and stop their own Vite server. They exercise sample-mode UI; database tests exercise the actual schema in PGlite (embedded PostgreSQL), with a small Supabase Auth shim. They do not establish live Supabase Auth behaviour or simultaneous connections.

## Files

- `src/` — UI, live Supabase adapter, sample workspace and styles.
- `database/001_schema.sql` — schema, triggers, policies, controlled functions and grants. Apply once to a fresh project.
- `database/002_demo_data.sql` — fictional donors and inventory. Apply once after the schema.
- `docs/START_HERE.md` — browser-only account/database/hosting walkthrough.
- `docs/DATABASE.md` — ER diagram, workflows, permissions and DBMS explanation.
- `docs/ACCEPTANCE.md` — reproducible classroom and live acceptance checks.
- `tests/` — PostgreSQL rule tests and browser workflow checks.

## Deployment

`npm run build` creates `dist/`, suitable for Cloudflare Pages direct upload. No server-side application secrets belong in that folder. Configure Supabase first, then upload the built files; see the guide. All devices must connect to the **same** Supabase project. Click Refresh to retrieve changes committed by other users; this version uses explicit refresh rather than realtime subscriptions.

## Status and boundaries

Code, embedded PostgreSQL tests, sample-mode browser tests and a production build can be verified without an external account. Creating the owner’s Supabase project, configuring its Auth password policy/rate limits, testing real email/phone login and deploying the site require owner account access. Those steps are not performed by the local sample mode. Use fictional data; the app records staff decisions and does not advise on transfusion compatibility.

No changes are automatically pushed to GitHub. Keep a copy of this repository and the deployment package for submission. Export application data separately; authentication accounts, passwords, provider settings and recovery delivery are not recreated by table CSV exports.

## Existing Cloudflare Workers Git deployment

The owner's current Cloudflare project is a Worker named `bloodmanagement`. `wrangler.jsonc` also supports deploying this frontend as Workers Static Assets: `npx wrangler deploy` runs the production build and uploads `dist/`. No application Worker script or server credentials are needed in the source. In Workers Builds, leave the root at `/` and the deploy command at `npx wrangler deploy`; Wrangler's build command prepares the site. If choosing Pages instead, use build command `npm run build` and output directory `dist`.

`.env.production` contains only the owner's public Supabase browser URL and publishable key so Git-based production builds are preconfigured. These values are intentionally public; never put privileged credentials in that file. `.env.local` stays ignored. Supabase policies and Auth configuration enforce access. Public registration must be disabled and the password policy verified in Supabase for the closed classroom demo before sharing the site.
