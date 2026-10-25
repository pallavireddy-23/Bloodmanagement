# Acceptance and demonstration checks

## Automated checks available in this workspace

- `npm test`: real PostgreSQL schema executed through PGlite with an Auth test shim. Checks anonymous denial; role protection; FEFO; repeated reservation; all-or-nothing shortage; competing sequential requests and unique allocation enforcement; expiry on issue; requester isolation; screening and quantity validation; heartbeat expiry/deduplication; server session events; protected audit history.
- `npm run test:ui`: Chromium workflows for login/sample workspace, request approval/reservation/issue, donor and donation creation, screening, history/search, requester navigation, and phone layout. This suite uses sample mode.
- `npm run build`: production static assets.

Embedded PostgreSQL uses one connection. Its tests do **not** prove simultaneous multi-connection locking or the actual Supabase Auth service. Complete the live checks below before submission. Do not present sample-mode role selection as authentication.

## Live checks after connecting Supabase

Use different app accounts in separate browsers or private windows. Keep fictional references only.

1. **Signed out:** opening the app shows login. With only the project's public browser key, a direct unauthenticated table request must fail. A direct authenticated requester write to `blood_units` or `profiles` must also fail.
2. **Password policy:** try changing an app password to `weak`, then a password missing uppercase or a symbol. Both the website and a direct Auth API call must reject it. Do not include real passwords in test logs.
3. **Email and phone:** if the optional phone route is enabled, sign in through both identifiers and compare `auth.getUser()` IDs. They must match the same canonical user. Demo phone identifiers are not ownership verified.
4. **Donations:** sign in as staff, add a fictional donor, record a unit with actual collection/expiry dates. It starts in quarantine. Record a screening note and release it. It enters stock only after release.
5. **FEFO:** seeded O+ units BF-011 and BF-012 expire in two and six days. BF-013 is quarantined and BF-014 is expired. Submit an O+ request for two units, approve with a staff reference, reserve, then open Details. Only BF-011 and BF-012 should appear. Repeat reservation through RPC; it must not allocate more units.
6. **Shortage:** request more units than are available. The error must leave the request approved and allocate zero units.
7. **Two users, shared stock:** reserve in one browser; click Refresh in the other. Both should show the same committed inventory. Reloading connected mode must retain records.
8. **Simultaneous last-unit competition:** on a fresh group reserve all but one eligible unit. Create and approve two new one-unit requests for that group. From two authenticated staff sessions invoke `reserve_request` at the same time, one request per session. Exactly one succeeds. Query allocations: no unit may have more than one reserved/issued allocation. If locking produces a temporary shortage, retry only after the first transaction completes; no extra stock should appear.
9. **Expiry at issue:** in a disposable test project, make a reserved unit expire before issue (or provision one with a near-future expiry and wait). Issuing must fail; the request remains reserved. Cancel to release its reservations. Do not modify real inventory dates to force this test.
10. **Cancellation/history:** cancel an unissued reservation and confirm its units return to available stock if still usable. An issued request must be impossible to cancel. Audit history must show the real authenticated actor and server time.
11. **Roles:** requester sees only their requests and allocations. Direct API calls must not expose donors, inventory, other requests or aggregate user counts. Staff cannot change app roles or settings. Only administrators can.
12. **Activity:** two tabs for one user count once. After heartbeat stops for more than five minutes, active count decreases. An administrator sees registered accounts, distinct sign-ins since Asia/Kolkata midnight, and recent activity; staff/requesters do not.
13. **Hosting:** sign in and perform a request workflow at the deployed HTTPS address on two devices. Confirm Supabase's Site URL/redirect settings, strong-password policy, session expiry and failed-login rate limits. Recheck any optional phone/recovery features separately.

## Five-minute classroom demonstration

1. Explain the single-bank PRBC scope and fictional data.
2. Sign in as staff and show available stock and expiry alerts.
3. Add a donor and quarantined donation; record screening release.
4. Submit, approve and reserve a two-unit request; show FEFO allocation IDs.
5. Show how insufficient inventory leaves no partial reservation.
6. Issue valid units and show the audit trail.
7. Use the administrator view for roles and user statistics.
8. Open the SQL editor to explain tables, joins, foreign keys, CHECK/UNIQUE constraints, RLS and transactional locks.

Actual phone login, multi-device persistence, simultaneous transactions and hosted behaviour remain unverified until a live project is configured. Record the results and date when performing them.
