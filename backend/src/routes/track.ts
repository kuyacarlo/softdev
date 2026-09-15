import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { bookings } from '../db/schema.js';
import type { AppContext } from '../types/env.js';
import {
  TrackBookingResponseSchema,
  ErrorResponseSchema,
  type BookingStatus,
  type EventCategory,
} from '@stella/schema';

export const trackRoutes = new OpenAPIHono<AppContext>();

// GET /api/track/:token - Customer self-service tracking
const trackBookingRoute = createRoute({
  method: 'get',
  path: '/{token}',
  tags: ['Tracking'],
  summary: 'Track Booking Status (Self-Service)',
  description: 'Allows guests to view real-time reservation status using their secure tracking token.',
  request: {
    params: z.object({
      token: z.string().min(10).openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: TrackBookingResponseSchema } },
      description: 'Booking tracking status found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid tracking token or booking not found',
    },
  },
});

trackRoutes.openapi(trackBookingRoute, async (c) => {
  const { token } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.trackingToken, token),
    with: {
      customer: true,
      package: true,
    },
  });

  if (!booking || !booking.package || !booking.customer) {
    return c.json(
      {
        success: false as const,
        error: 'NOT_FOUND',
        message: 'No catering reservation found matching this tracking token.',
      },
      404
    );
  }

  let inclusionsArray: string[] | undefined = undefined;
  if (booking.package.inclusions) {
    try {
      inclusionsArray = JSON.parse(booking.package.inclusions);
    } catch {
      inclusionsArray = [booking.package.inclusions];
    }
  }

  return c.json(
    {
      success: true as const,
      data: {
        bookingId: booking.bookingId,
        trackingToken: booking.trackingToken,
        status: booking.status as BookingStatus,
        eventDate: booking.eventDate,
        venueLocation: booking.venueLocation,
        guestCount: booking.guestCount,
        designThemeNotes: booking.designThemeNotes ?? null,
        referenceImageUrl: booking.referenceImageUrl ?? null,
        customerName: booking.customer.fullName,
        packageName: booking.package.packageName,
        eventCategory: booking.package.eventCategory as EventCategory,
        basePrice: booking.package.basePrice,
        inclusions: inclusionsArray,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    },
    200
  );
});
