import { z } from '@hono/zod-openapi';
import { BOOKING_STATUSES, EVENT_CATEGORIES } from './constants.js';

export const TrackBookingSchema = z.object({
  bookingId: z.number().int().openapi({ example: 1 }),
  trackingToken: z.string().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
  status: z.enum(BOOKING_STATUSES).openapi({ example: 'Pending' }),
  eventDate: z.string().openapi({ example: '2026-10-30' }),
  venueLocation: z.string().openapi({ example: 'Hiyas Convention Center, Malolos, Bulacan' }),
  guestCount: z.number().int().openapi({ example: 100 }),
  designThemeNotes: z.string().nullable().optional().openapi({ example: 'Rustic garden theme' }),
  referenceImageUrl: z.string().nullable().optional().openapi({ example: null }),
  customerName: z.string().openapi({ example: 'Maria Santos' }),
  packageName: z.string().openapi({ example: 'Grand Emerald Wedding Package' }),
  eventCategory: z.enum(EVENT_CATEGORIES).openapi({ example: 'Wedding' }),
  basePrice: z.number().openapi({ example: 45000.0 }),
  inclusions: z.array(z.string()).optional().openapi({ example: ['5-course buffet', 'Uniformed waitstaff'] }),
  createdAt: z.string().openapi({ example: '2026-09-01T12:00:00Z' }),
  updatedAt: z.string().openapi({ example: '2026-09-01T12:00:00Z' }),
}).openapi('TrackBookingData');

export const TrackBookingResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: TrackBookingSchema,
}).openapi('TrackBookingResponse');

export type TrackBookingData = z.infer<typeof TrackBookingSchema>;
export type TrackBookingResponse = z.infer<typeof TrackBookingResponseSchema>;
