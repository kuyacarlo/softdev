# Casa de Stella Catering — Backend API

Cloudflare Edge API built with **Hono**, **@hono/zod-openapi**, **Drizzle ORM**, **Cloudflare D1 (SQLite)**, and **Cloudflare R2**.

## Architecture & Features

- **Edge Runtime:** Runs on Cloudflare Workers with global low latency.
- **Shared Schemas:** Single source of truth via `@stella/schema` workspace package.
- **Strict Validation:** Edge border validation via Zod and `@hono/zod-openapi`.
- **Database:** SQLite relational schema powered by Cloudflare D1 and Drizzle ORM.
- **Interactive Documentation:** Live Scalar API docs at `/docs` and OpenAPI 3.1 JSON at `/openapi.json`.
- **Admin Auth:** JWT authentication (`hono/jwt`) and edge-safe password hashing (`bcrypt-ts`).
- **Guest Tracking:** Token-based self-service tracking for real-time status inquiries.

## Scripts

```bash
# Start local development worker
pnpm dev

# Run TypeScript typecheck
pnpm build

# Generate Drizzle migration files
pnpm db:generate

# Apply migrations locally (D1)
pnpm db:migrate:local

# Apply migrations to remote Cloudflare D1
pnpm db:migrate:remote

# Run Vitest test suite
pnpm test
```
