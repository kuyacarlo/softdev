# Project Pitfalls, Edge Hazards & Engineering Mitigations
**Project:** Casa de Stella Catering Services Platform  
**Target Infrastructure:** Cloudflare Edge Ecosystem (Astro + Hono + D1 + R2 + Drizzle)  
**Document Purpose:** Pre-empt runtime failures, edge quirks, and team workflow breakdowns  

---

## 1. Cloudflare D1 & SQLite Database Pitfalls

### ⚠️ Pitfall 1.1: Date & Timezone Drift (The "Day-Behind" Bug)
* **The Hazard:** SQLite/D1 does not have a native `TIMESTAMP WITH TIME ZONE` column type like PostgreSQL. It stores dates as text (`VARCHAR`/`TEXT`) or integer Unix timestamps.
* **The Failure Mode:** If the client in the Philippines (PHT, UTC+8) picks `2026-10-25`, converting to a JavaScript `new Date().toISOString()` converts it to `2026-10-24T16:00:00.000Z`. The database records the 24th, shifting event schedules and calendar slots back by one full day.
* **Mitigation:**
  * Store all event booking dates strictly as **date-only ISO strings (`YYYY-MM-DD`)**.
  * Never pass client-localized timestamps into date queries; compare against date strings directly (`WHERE event_date = '2026-10-25'`).

---

### ⚠️ Pitfall 1.2: Silent Foreign Key Failure in SQLite
* **The Hazard:** In SQLite and D1, foreign key constraints are **disabled by default** unless explicitly enabled per session connection.
* **The Failure Mode:** If foreign keys are disabled, inserting a booking with a non-existent `package_id` or `customer_id` will succeed silently without error, corrupting relational integrity.
* **Mitigation:**
  * Drizzle ORM handles relational joins at application level, but execute `PRAGMA foreign_keys = ON;` in D1 migrations.
  * Always validate existence in Zod / Drizzle before running inserts.

---

### ⚠️ Pitfall 1.3: D1 Migration Drift Between Local and Remote
* **The Hazard:** Team members modify `schema.ts` in TypeScript and test locally, but forget to generate SQL migration files using Drizzle Kit.
* **The Failure Mode:** Code runs locally against local SQLite state but crashes immediately upon deployment to Cloudflare (`no such table: customer`).
* **Mitigation:**
  * Enforce npm scripts for migrations:
    * `pnpm db:generate` $\rightarrow$ creates migration files in `drizzle/`
    * `pnpm db:migrate:local` $\rightarrow$ applies to `.wrangler/state/v3/d1`
    * `pnpm db:migrate:remote` $\rightarrow$ applies to production Cloudflare D1

---

## 2. Cloudflare Workers & Edge Runtime Pitfalls

### ⚠️ Pitfall 2.1: The `process.env` Trap
* **The Hazard:** Teammates used to Node.js / Express will write `const secret = process.env.JWT_SECRET`.
* **The Failure Mode:** In Cloudflare Workers, `process.env` does not exist. The variable evaluates to `undefined`, causing token signing/verification to fail with cryptic errors.
* **Mitigation:**
  * Access environment bindings exclusively via Hono Context: `c.env.JWT_SECRET` and `c.env.DB`.
  * Pass strict TypeScript generic types to the Hono instance: `new OpenAPIHono<{ Bindings: Env }>()`.

---

### ⚠️ Pitfall 2.2: Unsupported Node.js Native Libraries
* **The Hazard:** Importing packages that rely on Node.js C++ bindings (e.g., standard `bcrypt`, `canvas`, `sharp`, `fs`, `path`).
* **The Failure Mode:** Wrangler build fails or throws `Dynamic require of "..." is not supported` at runtime.
* **Mitigation:**
  * Use pure Web Crypto APIs (`crypto.subtle`) or edge-safe libraries like `@noble/hashes` or `bcrypt-ts` for password hashing.
  * Use `hono/jwt` for JWT signing (native Web Crypto implementation).

---

### ⚠️ Pitfall 2.3: CORS Preflight Blockers in Development
* **The Hazard:** Astro runs on `http://localhost:4321`, while the Hono worker runs on `http://localhost:8787`.
* **The Failure Mode:** Browser blocks POST requests with `CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource`.
* **Mitigation:**
  * Mount Hono's `cors()` middleware with explicit origin allowance and exposed headers before mounting route handlers.

---

## 3. Media & Cloudflare R2 Upload Pitfalls

### ⚠️ Pitfall 3.1: Worker CPU Exhaustion on File Uploads
* **The Hazard:** Uploading 5MB reference photos directly through the Worker as a multipart form stream consumes Worker CPU time and memory limits.
* **The Failure Mode:** Large file uploads time out on the Cloudflare free tier (50ms CPU time limit on free tier).
* **Mitigation:**
  * Use the Worker solely to generate **R2 Pre-signed PUT URLs**.
  * The frontend client uploads the image directly to Cloudflare R2, bypassing Worker CPU load completely.

---

### ⚠️ Pitfall 3.2: Private Bucket Image Display
* **The Hazard:** Cloudflare R2 buckets are private by default; uploaded image URLs cannot be loaded directly by `<img>` tags in browsers.
* **The Failure Mode:** Customer reference images and event design gallery photos return `403 Forbidden`.
* **Mitigation:**
  * Enable **R2 Public Access / Custom Domain** on the bucket (e.g., `media.stellascatering.com`), or
  * Serve images via a lightweight streaming route on the Worker: `app.get('/api/media/:key', ...)`.

---

## 4. Team Workflow & "Vibecoding" Pitfalls

### ⚠️ Pitfall 4.1: Frontend-Backend Schema Desynchronization
* **The Hazard:** A teammate edits a form field name on the frontend (e.g., changing `contactNumber` to `phone`) without updating the backend Zod schema.
* **The Failure Mode:** The API rejects submissions with `400 Bad Request` (`contactNumber: Required`), but the UI shows a generic error, confusing both the user and developer.
* **Mitigation (Worksight Pattern):**
  * Use a shared workspace package (`packages/schema` or `@stella/schema`) as the **Single Source of Truth** for both frontend and backend.
  * If someone alters a schema field in `@stella/schema`, TypeScript will immediately show red squiggly lines and fail the build on both `frontend` and `backend` before broken code can be pushed.

---

### ⚠️ Pitfall 4.2: Booking Collision Race Condition
* **The Hazard:** Two customers attempt to book the final available slot for the same date at the exact same second.
* **The Failure Mode:** Both requests pass the initial capacity check (`count < 3`) simultaneously and insert two bookings, exceeding maximum capacity.
* **Mitigation:**
  * Keep booking insertions in an atomic transaction.
  * Validate capacity inside the insertion transaction before committing the new record.
