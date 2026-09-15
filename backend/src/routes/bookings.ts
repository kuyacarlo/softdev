import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { bookings, customers, cateringPackages } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppContext } from '../types/env.js';
import {
  CreateBookingSchema,
  CreateBookingResponseSchema,
  BookingListResponseSchema,
  BookingDetailResponseSchema,
  UpdateBookingStatusSchema,
  BookingFilterQuerySchema,
  ErrorResponseSchema,
  type BookingStatus,
  type EventCategory,
} from '@stella/schema';

export const bookingRoutes = new OpenAPIHono<AppContext>();

// Helper to format booking record with nested customer and package
function formatBooking(record: any) {
  let inclusionsArray: string[] | undefined = undefined;
  if (record.package?.inclusions) {
    try {
      inclusionsArray = JSON.parse(record.package.inclusions);
    } catch {
      inclusionsArray = [record.package.inclusions];
    }
  }

  return {
    bookingId: record.bookingId,
    customerId: record.customerId,
    packageId: record.packageId,
    approvedBy: record.approvedBy ?? null,
    eventDate: record.eventDate,
    venueLocation: record.venueLocation,
    guestCount: record.guestCount,
    designThemeNotes: record.designThemeNotes ?? null,
    referenceImageUrl: record.referenceImageUrl ?? null,
    trackingToken: record.trackingToken,
    status: record.status as BookingStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    customer: record.customer
      ? {
          customerId: record.customer.customerId,
          fullName: record.customer.fullName,
          contactNumber: record.customer.contactNumber,
          email: record.customer.email,
          createdAt: record.customer.createdAt,
        }
      : undefined,
    package: record.package
      ? {
          packageId: record.package.packageId,
          packageName: record.package.packageName,
          eventCategory: record.package.eventCategory as EventCategory,
          basePrice: record.package.basePrice,
          minPax: record.package.minPax,
          isAvailable: Boolean(record.package.isAvailable),
          inclusions: inclusionsArray,
          createdAt: record.package.createdAt,
        }
      : undefined,
  };
}

// 1. POST /api/bookings - Submit public booking request
const createBookingRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Bookings'],
  summary: 'Submit Catering Booking Request',
  description: 'Public self-service booking intake. Generates a unique tracking token for live status monitoring.',
  request: {
    body: {
      content: { 'application/json': { schema: CreateBookingSchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateBookingResponseSchema } },
      description: 'Booking request registered with tracking token',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation failure or package unavailable',
    },
  },
});

bookingRoutes.openapi(createBookingRoute, async (c) => {
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Validate package existence and availability
  const pkg = await db.query.cateringPackages.findFirst({
    where: eq(cateringPackages.packageId, data.packageId),
  });

  if (!pkg) {
    return c.json(
      {
        success: false as const,
        error: 'INVALID_PACKAGE',
        message: `Selected catering package (ID: ${data.packageId}) does not exist.`,
      },
      400
    );
  }

  if (!pkg.isAvailable) {
    return c.json(
      {
        success: false as const,
        error: 'PACKAGE_UNAVAILABLE',
        message: `The package "${pkg.packageName}" is currently not accepting new reservations.`,
      },
      400
    );
  }

  if (data.guestCount < pkg.minPax) {
    return c.json(
      {
        success: false as const,
        error: 'PAX_REQUIREMENT_UNMET',
        message: `The package "${pkg.packageName}" requires a minimum of ${pkg.minPax} guests.`,
      },
      400
    );
  }

  // Find or insert customer record
  let customer = await db.query.customers.findFirst({
    where: eq(customers.email, data.email),
  });

  if (!customer) {
    const [newCustomer] = await db
      .insert(customers)
      .values({
        fullName: data.fullName,
        contactNumber: data.contactNumber,
        email: data.email,
      })
      .returning();
    customer = newCustomer;
  }

  // Generate secure random tracking token
  const trackingToken = crypto.randomUUID();

  // Insert booking transaction
  const [newBooking] = await db
    .insert(bookings)
    .values({
      customerId: customer.customerId,
      packageId: data.packageId,
      eventDate: data.eventDate,
      venueLocation: data.venueLocation,
      guestCount: data.guestCount,
      designThemeNotes: data.designThemeNotes || null,
      referenceImageUrl: data.referenceImageUrl || null,
      trackingToken,
      status: 'Pending',
    })
    .returning();

  return c.json(
    {
      success: true as const,
      data: {
        bookingId: newBooking.bookingId,
        trackingToken: newBooking.trackingToken,
        status: newBooking.status as BookingStatus,
      },
    },
    201
  );
});

// 2. GET /api/bookings - Admin list bookings with filtering
const listBookingsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Bookings'],
  summary: 'List All Bookings (Admin)',
  description: 'Retrieves all booking requests with customer and package details.',
  security: [{ Bearer: [] }],
  request: {
    query: BookingFilterQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BookingListResponseSchema } },
      description: 'List of bookings',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

bookingRoutes.openapi(listBookingsRoute, async (c) => {
  const { status, startDate, endDate } = c.req.valid('query');
  const db = getDb(c.env.DB);

  const filters = [];
  if (status) {
    filters.push(eq(bookings.status, status));
  }
  if (startDate) {
    filters.push(gte(bookings.eventDate, startDate));
  }
  if (endDate) {
    filters.push(lte(bookings.eventDate, endDate));
  }

  const query = filters.length > 0 ? and(...filters) : undefined;
  const records = await db.query.bookings.findMany({
    where: query,
    with: {
      customer: true,
      package: true,
    },
    orderBy: [desc(bookings.createdAt)],
  });

  return c.json(
    {
      success: true as const,
      data: records.map(formatBooking),
    },
    200
  );
});

// 3. GET /api/bookings/:id - Admin get booking details
const getBookingRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Bookings'],
  summary: 'Get Booking Details (Admin)',
  description: 'Retrieves detailed booking record by ID with full customer and package relations.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BookingDetailResponseSchema } },
      description: 'Booking details found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Booking not found',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

bookingRoutes.openapi(getBookingRoute, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const record = await db.query.bookings.findFirst({
    where: eq(bookings.bookingId, id),
    with: {
      customer: true,
      package: true,
    },
  });

  if (!record) {
    return c.json(
      {
        success: false as const,
        error: 'NOT_FOUND',
        message: `Booking with ID ${id} was not found.`,
      },
      404
    );
  }

  return c.json(
    {
      success: true as const,
      data: formatBooking(record),
    },
    200
  );
});

// 4. PATCH /api/bookings/:id/status - Admin update booking status
const updateBookingStatusRoute = createRoute({
  method: 'patch',
  path: '/{id}/status',
  tags: ['Bookings'],
  summary: 'Update Booking Status (Admin)',
  description: 'Modifies booking lifecycle status (Confirmed, Declined, Completed, Cancelled) and logs reviewer attribution.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive().openapi({ example: 1 }),
    }),
    body: {
      content: { 'application/json': { schema: UpdateBookingStatusSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BookingDetailResponseSchema } },
      description: 'Booking status updated successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Booking not found',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

// Mount admin auth guards on protected booking paths
bookingRoutes.use('/', async (c, next) => {
  if (c.req.method === 'GET') return requireAuth(c, next);
  return next();
});
bookingRoutes.use('/{id}', requireAuth);
bookingRoutes.use('/{id}/status', requireAuth);

bookingRoutes.openapi(updateBookingStatusRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { status } = c.req.valid('json');
  const user = c.get('user');
  const db = getDb(c.env.DB);

  const existing = await db.query.bookings.findFirst({
    where: eq(bookings.bookingId, id),
  });

  if (!existing) {
    return c.json(
      {
        success: false as const,
        error: 'NOT_FOUND',
        message: `Booking with ID ${id} not found.`,
      },
      404
    );
  }

  const nowIso = new Date().toISOString();
  await db
    .update(bookings)
    .set({
      status,
      approvedBy: user?.adminId ?? null,
      updatedAt: nowIso,
    })
    .where(eq(bookings.bookingId, id));

  const updated = await db.query.bookings.findFirst({
    where: eq(bookings.bookingId, id),
    with: {
      customer: true,
      package: true,
    },
  });

  return c.json(
    {
      success: true as const,
      data: formatBooking(updated),
    },
    200
  );
});
