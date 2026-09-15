# Engineering Guardrails, Code Constraints & Architecture Standards
**Project:** Casa de Stella Catering Services Web Platform  
**Target Infrastructure:** 100% Cloudflare Edge (Astro Pages + Hono Workers + D1 + R2 + Drizzle)  
**Status:** Architecture Guardrails & Team Coding Standard  

---

## 1. Feature Scope Alignment

* **Guest Tracking URL (Token-Based):** Customers submit bookings without an account. The system generates a secure, unique tracking URL (e.g., `/track/:bookingToken`) sent via email/confirmation screen so clients can view live status (`Pending`, `Confirmed`, `Declined`) without adding admin workload.
* **Roadmap for v1:**
  * **Venue Distance / Delivery Tiering (3.1):** Simplified zone/distance lookup during checkout on the v1 roadmap.
  * **Deposit & Payment Confirmation Tracking (3.3):** Reference code upload or payment confirmation link on the v1 roadmap.
  * **Kitchen Inventory (3.2):** Explicitly excluded (out of scope).
* **All Must-Have and Should-Have Rules:** Enforced in MVP core.

---

## 2. Architectural & Code Constraints (Team Guardrails)

To keep the codebase maintainable, readable in under 5 seconds, and impossible for team members to break through "vibecoding", the following architectural invariants are enforced:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           TEAM ARCHITECTURAL GUARDRAILS                          │
├────────────────────────────────┬─────────────────────────────────────────────────┤
│ 1. Flat Layer Architecture     │ Max 2 layers: [Route Handler] ──> [Drizzle Query]│
│ 2. Border Validation Rule      │ Validate at HTTP boundary via Zod; trust types  │
│ 3. Zero 'any' & Inferred Types │ Use z.infer<typeof Schema>; never use `any`     │
│ 4. Atomic Multi-Table Writes   │ Customer + Booking writes must be atomic/batched│
│ 5. Stateless Edge Invariant    │ No global mutable memory; state belongs in D1/R2 │
│ 6. Standardized Response Shape │ Consistent JSON envelope for success and errors │
│ 7. No Raw String SQL           │ 100% Drizzle ORM query builder to prevent SQLi  │
└────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

### Rule 1: Flat Layer Architecture (No Over-Abstraction)
* **Constraint:** Forbid deep enterprise patterns like `Controllers -> Service Classes -> Repositories -> DAOs -> DTOs`.
* **Standard:** Routes are grouped logically by entity (`routes/packages.ts`, `routes/bookings.ts`, `routes/auth.ts`). A route function directly executes its Drizzle query and returns the response.
* **Why:** Any team member can open a file, read 15 lines of code, and understand the route immediately.

---

### Rule 2: "Validate at the Border, Trust Within"
* **Constraint:** Never validate inputs manually inside business logic with sprawling `if/else` checks.
* **Standard:** All route inputs (JSON body, query parameters, URL path variables) **MUST** pass through a Zod schema via `@hono/zod-openapi` before the route handler code ever executes.
* **Why:** If the request reaches the handler, the data is guaranteed to be clean, sanitized, and type-safe.

---

### Rule 3: Zero `any` & Inferred Types
* **Constraint:** The TypeScript keyword `any` is strictly prohibited (`@typescript-eslint/no-explicit-any: error`).
* **Standard:** Derive TypeScript types directly from Zod schemas and Drizzle tables:
  ```typescript
  // Derived automatically — never manually maintained:
  export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
  export type BookingRecord = typeof bookings.$inferSelect;
  export type NewBookingRecord = typeof bookings.$inferInsert;
  ```
* **Why:** Eliminates duplicate interface definitions that fall out of sync when the database schema changes.

---

### Rule 4: Atomic Multi-Table Writes (No Orphaned Records)
* **Constraint:** Creating a `Customer` and a `Booking` simultaneously must never result in an orphaned customer if the booking insertion fails.
* **Standard:** Use D1 batch operations or sequential validation:
  ```typescript
  // Validate and insert customer, then insert booking with foreign key constraint
  const [customer] = await db.insert(customers).values(customerData).returning();
  const [booking] = await db.insert(bookings).values({
    ...bookingData,
    customerId: customer.customerId,
  }).returning();
  ```

---

### Rule 5: Stateless Edge Invariant
* **Constraint:** Do not declare global state variables or caches in the module root (e.g., `let cachedBookings = []`).
* **Reason:** Cloudflare Workers spin up and tear down across hundreds of edge locations globally. Global variables are isolated to individual worker instances and do not sync.
* **Standard:** All mutable state lives exclusively inside **Cloudflare D1** (relational data) or **Cloudflare R2** (image files).

---

### Rule 6: Standardized JSON Response & Error Envelopes
* **Constraint:** Never return raw unstructured text strings or unformatted database errors to the frontend.
* **Standard:** All API responses adhere to a consistent contract:
  ```typescript
  // Success Response Envelope
  {
    "success": true,
    "data": { ... }
  }

  // Error Response Envelope (4xx / 5xx)
  {
    "success": false,
    "error": "Error title or code",
    "message": "User-friendly explanation of what went wrong",
    "details": [ ... ] // Optional Zod validation issues
  }
  ```

---

### Rule 7: Zero Raw SQL String Concatenation
* **Constraint:** Never use template literals to construct raw SQL strings (e.g., `db.run(`SELECT * FROM bookings WHERE id = ${id}`)`).
* **Standard:** Always use Drizzle query builders (`db.select().from(...).where(eq(...))`) or parameterized `sql` tagged template literals (`sql`...``).

---

## 3. OpenAPI & Self-Documenting Route Blueprint

```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { bookings, customers } from '../db/schema';
import { CreateBookingSchema, BookingResponseSchema, ErrorSchema } from '../schemas/booking';

export const bookingRoutes = new OpenAPIHono<{ Bindings: Env }>();

// 1. Self-Documenting OpenAPI Route Contract
const createBooking = createRoute({
  method: 'post',
  path: '/',
  tags: ['Bookings'],
  summary: 'Submit a new catering booking request (Guest submission)',
  request: {
    body: {
      content: { 'application/json': { schema: CreateBookingSchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: BookingResponseSchema } },
      description: 'Booking submitted successfully with tracking URL token',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Validation failed (e.g., date within 7 days, guest count < 30)',
    },
  },
});

// 2. Linear Route Handler (Readable in under 5 seconds)
bookingRoutes.openapi(createBooking, async (c) => {
  const data = c.req.valid('json');
  const db = drizzle(c.env.DB);

  // Generate secure random tracking token
  const trackingToken = crypto.randomUUID();

  // Insert customer details
  const [customer] = await db.insert(customers).values({
    fullName: data.fullName,
    contactNumber: data.contactNumber,
    email: data.email,
  }).returning();

  // Insert booking linked to customer
  const [booking] = await db.insert(bookings).values({
    customerId: customer.customerId,
    packageId: data.packageId,
    eventDate: data.eventDate,
    venueLocation: data.venueLocation,
    guestCount: data.guestCount,
    designThemeNotes: data.designThemeNotes,
    referenceImageUrl: data.referenceImageUrl,
    trackingToken: trackingToken,
    status: 'Pending',
  }).returning();

  return c.json({
    success: true,
    data: {
      bookingId: booking.bookingId,
      trackingToken: booking.trackingToken,
      status: booking.status,
    },
  }, 201);
});
```
