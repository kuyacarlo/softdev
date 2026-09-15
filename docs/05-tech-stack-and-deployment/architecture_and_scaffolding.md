# Technical Architecture & Scaffolding Plan
**Project:** Casa de Stella Catering Services Web Platform  
**Target Infrastructure:** 100% Cloudflare Edge Ecosystem (Monorepo with Shared Schema)  
**Stack Decision:** Astro (Pages) + Hono (Workers) + Zod + Drizzle ORM + Cloudflare D1 & R2 + Shared Schema Package  
**Status:** Architecture Locked & Approved  

---

## 1. Monorepo Shared Schema Architecture (Worksight Pattern)

To eliminate **Frontend-Backend Schema Desynchronization** and stop "vibecoding" drift in its tracks, all validation schemas, TypeScript interfaces, and domain constants are extracted into a shared workspace package (`packages/schema` or `shared/`):

```
                               ┌────────────────────────┐
                               │  @stella/schema        │
                               │  (packages/schema/)    │
                               │  • Zod Schemas         │
                               │  • Inferred TS Types   │
                               │  • Domain Constants    │
                               └───────────┬────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
     ┌────────────────────────────┐                ┌────────────────────────────┐
     │  FRONTEND (Astro Pages)    │                │  BACKEND (Hono Worker)     │
     │  • Client-side form checks │                │  • @hono/zod-openapi       │
     │  • Autocomplete on fetch   │                │  • Edge request validation │
     │  • Shared domain constants │                │  • OpenAPI doc generation  │
     └────────────────────────────┘                └────────────────────────────┘
```

---

## 2. Project Directory Tree (PNPM Workspace Monorepo)

```
softdev/
├── pnpm-workspace.yaml             # Monorepo configuration linking all packages
├── package.json                    # Root scripts (pnpm dev, pnpm build, pnpm db:*)
│
├── packages/
│   └── schema/                     # Shared Single Source of Truth (@stella/schema)
│       ├── src/
│       │   ├── booking.ts          # CreateBookingSchema, BookingResponseSchema
│       │   ├── package.ts          # CateringPackageSchema, CategoryEnum
│       │   ├── auth.ts             # AdminLoginSchema, TokenPayloadSchema
│       │   ├── constants.ts        # MIN_PAX = 30, MIN_LEAD_DAYS = 7, CATEGORIES
│       │   └── index.ts            # Root export for types and schemas
│       ├── tsconfig.json
│       └── package.json
│
├── frontend/                       # Astro 5.x Client Application (Cloudflare Pages)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.astro
│   │   │   ├── PackageCard.astro   # Catering package card (Static)
│   │   │   ├── MenuSection.astro   # Food catalog viewer (Static)
│   │   │   └── BookingWizard.tsx   # Interactive Form using @stella/schema for validation
│   │   ├── layouts/
│   │   │   ├── BaseLayout.astro
│   │   │   └── AdminLayout.astro
│   │   ├── pages/
│   │   │   ├── index.astro         # Hero & Featured Packages
│   │   │   ├── packages.astro      # Full Filterable Catalog
│   │   │   ├── book.astro          # Public Booking Submission
│   │   │   ├── track/
│   │   │   │   └── [token].astro   # Self-service booking tracking view
│   │   │   └── admin/
│   │   │       ├── index.astro     # Admin Dashboard (Bookings List)
│   │   │       ├── packages.astro  # Package Management
│   │   │       └── login.astro     # Admin Authentication
│   │   └── lib/
│   │       └── api-client.ts       # Typed Fetch Client importing types from @stella/schema
│   ├── astro.config.mjs
│   └── package.json
│
├── backend/                        # Hono API (Cloudflare Workers + D1 + R2)
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts            # Drizzle D1 Client Initialization
│   │   │   └── schema.ts           # Drizzle D1 Table Schemas
│   │   ├── routes/
│   │   │   ├── packages.ts         # GET /packages, POST/PUT /packages (Admin)
│   │   │   ├── bookings.ts         # POST /bookings (Public), GET/PATCH (Admin)
│   │   │   ├── track.ts            # GET /track/:token (Customer self-service)
│   │   │   ├── auth.ts             # POST /auth/login (JWT)
│   │   │   └── uploads.ts          # R2 pre-signed upload handler
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT Verification Middleware
│   │   └── index.ts                # Main Hono OpenAPI app & Scalar docs
│   ├── drizzle/                    # Generated SQL Migration Files
│   ├── drizzle.config.ts           # Drizzle Kit Configuration for D1
│   ├── wrangler.toml               # Cloudflare Workers, D1 & R2 Bindings
│   ├── tsconfig.json
│   └── package.json
│
└── docs/                           # Engineering Blueprints, Mini-SRS & Specs
```

---

## 3. Shared Schema Implementation Example

### `packages/schema/src/constants.ts`
```typescript
export const MIN_PAX_COUNT = 30;
export const MIN_LEAD_TIME_DAYS = 7;
export const EVENT_CATEGORIES = [
  'Wedding',
  'Debut',
  'Birthday',
  'Corporate',
  'Special Event',
] as const;

export const BOOKING_STATUSES = [
  'Pending',
  'Confirmed',
  'Declined',
  'Completed',
  'Cancelled',
] as const;
```

### `packages/schema/src/booking.ts`
```typescript
import { z } from 'zod';
import { MIN_PAX_COUNT, MIN_LEAD_TIME_DAYS, BOOKING_STATUSES } from './constants';

export const CreateBookingSchema = z.object({
  fullName: z.string().min(2, "Full name is required (min 2 characters)"),
  contactNumber: z.string().regex(/^(09|\+639)\d{9}$/, "Must be a valid Philippine mobile number"),
  email: z.string().email("Invalid email address"),
  packageId: z.number().int().positive("A valid catering package must be selected"),
  eventDate: z.string().refine((val) => {
    const target = new Date(val);
    const minLeadTime = new Date();
    minLeadTime.setDate(minLeadTime.getDate() + MIN_LEAD_TIME_DAYS);
    return target >= minLeadTime;
  }, `Event date must be at least ${MIN_LEAD_TIME_DAYS} days from today (BR-002)`),
  venueLocation: z.string().min(5, "Venue location is required"),
  guestCount: z.number().int().min(MIN_PAX_COUNT, `Minimum guest count is ${MIN_PAX_COUNT} pax`),
  designThemeNotes: z.string().optional(),
  referenceImageUrl: z.string().url("Must be a valid URL").optional(),
});

export const BookingResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    bookingId: z.number(),
    trackingToken: z.string(),
    status: z.enum(BOOKING_STATUSES),
  }),
});

export const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  details: z.array(z.any()).optional(),
});

// Inferred TypeScript Types (Exported for Frontend and Backend)
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type BookingResponse = z.infer<typeof BookingResponseSchema>;
export type ApiError = z.infer<typeof ErrorSchema>;
```

---

## 4. How Frontend & Backend Consume `@stella/schema`

### Frontend Usage (`frontend/src/lib/api-client.ts`)
```typescript
import type { CreateBookingInput, BookingResponse } from '@stella/schema';

export async function submitBooking(payload: CreateBookingInput): Promise<BookingResponse> {
  const res = await fetch('https://api.stellascatering.com/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Booking failed');
  return res.json();
}
```

### Backend Usage (`backend/src/routes/bookings.ts`)
```typescript
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { CreateBookingSchema, BookingResponseSchema, ErrorSchema } from '@stella/schema';

// Passed directly into OpenAPI route definition without duplicate typing!
```
