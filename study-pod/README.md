# StudyPod — Study Pod Reservation System

Implementation of the **Study Pod Reservation System** specified in
[`docs/03-srs/srs-study-pod.md`](../docs/03-srs/srs-study-pod.md) (CPE 304/304L, Group 2-1).

Students browse live pod availability, reserve a pod, and check in by QR code or kiosk PIN.
Reservations that are not checked in within the grace period are released automatically.
Library staff manage the pod inventory, oversee and override reservations, and view utilization reports.

See [`docs/traceability.md`](docs/traceability.md) for a requirement-by-requirement map to code and tests.

## Architecture

```
Browser (React SPA, mobile-first)          Campus SSO (OAuth2 / OIDC + PKCE)
        │  HTTPS, same origin                     ▲
        ▼                                         │
Cloudflare Worker ── Hono API (/api/*) ───────────┘
        │   ├─ static assets (dist/) for every other path
        │   └─ cron trigger, every minute: no-show release, completion, reminders
        ▼
Cloudflare D1 (SQLite) ── student, admin_staff, study_pod, reservation, pod_slot,
                          setting, notification, audit_log
```

| Layer | Tech | Where |
| --- | --- | --- |
| Web client | React 19, React Router 7, Vite, plain CSS | `src/web/` |
| API + jobs | Cloudflare Workers, Hono, Zod | `src/worker/` |
| Database | Cloudflare D1 (SQLite), SQL migrations | `migrations/` |
| Email | Resend HTTP API (prod) or console log (dev), all recorded in `notification` | `src/worker/lib/email.ts` |
| Tests | Vitest on Node's built-in SQLite, with a D1-compatible adapter | `tests/` |

### Key design decisions

- **Double booking is impossible at the database level (SRS 3.8).** Each live reservation
  owns one `pod_slot` row per 15-minute slot it covers, and the primary key is `(pod_id, slot_start_at)`.
  The reservation and its slots are written in one transactional D1 batch, so if two students
  race for the same slot, one batch fails on the key and the loser gets a "no longer available"
  message along with current availability (SRS 3.2.2.5).
- **One active reservation per student (SRS 3.6)** is enforced by a partial unique index on
  `reservation(student_id) WHERE status IN ('Confirmed','CheckedIn')`.
- **No-show release (SRS 3.2.4, 3.5.2)** runs from a per-minute cron trigger. The same sweep
  also runs before every availability search, booking and check-in, so a delayed cron run can
  never leave a pod falsely reserved.
- **Policy is data, not code (SRS 3.5.5).** Durations, grace period, cutoffs, the advance-booking
  limit and operating hours live in the `setting` table and can be edited under Admin → Settings.
- **No password store (SRS 3.5.4).** Sign-in uses the campus IdP through the OAuth2
  authorization-code flow with PKCE. Staff are recognised by an `admin_staff` row matching their
  SSO email, and their role is re-checked against the database on every admin request.
- **Campus-local time (SRS 2.4).** Instants are stored in UTC. Dates and times are computed in
  `CAMPUS_TZ`, which defaults to `Asia/Manila`.

### Reservation lifecycle

```
            create            check in (QR / kiosk PIN / staff)        end time or "end early"
  ──────▶ Confirmed ─────────────────────────▶ CheckedIn ───────────────────────▶ Completed
             │  │
             │  └── no check-in by start + grace ──▶ NoShow   (pod released, student emailed)
             └───── student cancel / staff force-cancel ──▶ Cancelled
```

`Completed` adds one state to the four in the SRS. It records sessions that finished normally
and frees the student to book again.

## Running locally

Requires Node.js 22.13+.

```bash
cd study-pod
npm install
npm run setup     # creates .dev.vars (AUTH_MODE=dev), applies migrations, seeds demo pods/staff
npm run dev       # API on :8787, Vite dev server on http://localhost:5173
# or, for a production-like single server:
npm start         # builds the SPA, serves everything from http://localhost:8787
```

In dev mode, the sign-in page replaces campus SSO with a mock that offers demo identities:

| Identity | Role |
| --- | --- |
| `ana.cruz@campus.edu`, or any `@campus.edu` email | Student |
| `desk@campus.edu` | Front Desk staff |
| `manager@campus.edu` | Facility Manager |

Useful pages:
- `/`: find and reserve a pod
- `/me`: my reservation, with QR code and PIN
- `/checkin?pod=<id>`: the URL printed on each pod's QR sticker (Admin → Pods → QR label)
- `/kiosk`: shared check-in tablet (a staff member activates it for one building)
- `/admin`: staff console

```bash
npm test          # 52 API/domain tests
npm run typecheck
```

## Deploying (Cloudflare)

```bash
npx wrangler d1 create study-pod-db          # put the printed id into wrangler.toml
npm run db:migrate:remote
npx wrangler secret put SESSION_SECRET       # 32+ random characters
npx wrangler secret put SSO_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY       # if EMAIL_PROVIDER=resend
npm run deploy
```

Set these in `wrangler.toml` `[vars]`:
- `SSO_AUTHORIZE_URL`, `SSO_TOKEN_URL`, `SSO_USERINFO_URL`, `SSO_CLIENT_ID`
- `UNIVERSITY_EMAIL_DOMAIN`, `CAMPUS_TZ`, `APP_URL`, `EMAIL_PROVIDER`, `EMAIL_FROM`

For the first deploy, also set `BOOTSTRAP_MANAGER_EMAIL`. That account becomes the first
Facility Manager the first time it signs in, and can then add other staff under Admin → Staff.
Keep `AUTH_MODE="oidc"` in production.

> SAML-only identity providers need an OIDC bridge in front of them (most campus IdPs, such as
> Shibboleth, Azure AD/Entra and Google Workspace, already expose OIDC).

## API overview

| Method & path | Who | Purpose |
| --- | --- | --- |
| `GET /api/config` | anyone | policy, hours, locations, campus "today" |
| `GET /api/availability?date&startTime&durationMinutes&building&floor&minCapacity` | anyone | search plus a per-pod day timeline and alternatives |
| `GET /api/reservations/mine` · `GET /api/reservations/:code` | student | my active reservation and history |
| `POST /api/reservations` | student | create a reservation |
| `PATCH /api/reservations/:code` | student | modify (at least 15 min before start) |
| `POST /api/reservations/:code/cancel` · `/end` | student | cancel before check-in · end early |
| `POST /api/checkin` `{podId}` or `{code}` | student | QR check-in |
| `POST /api/kiosk/session` · `POST /api/kiosk/checkin` | staff · kiosk | activate a kiosk · PIN check-in |
| `GET /api/admin/reservations` · `POST …/:code/cancel` · `…/:code/check-in` · `POST /api/admin/walk-ins` | staff | oversight and overrides |
| `GET/POST/PATCH /api/admin/pods` · `POST /api/admin/pods/:id/status` | manager (front desk: maintenance only) | inventory |
| `GET /api/admin/reports` · `/reports/export.csv` | manager | utilization |
| `GET/PUT /api/admin/settings` · `/staff` · `/notifications` · `/audit` | staff / manager | configuration and logs |

Errors always return `{ "error": { "code", "message", "details?" } }`, where `message` is plain
language that the UI can show as-is (SRS 3.1.1). State-changing requests must send the
`X-StudyPod-Client` header, which protects against CSRF.
