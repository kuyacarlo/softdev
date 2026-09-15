import { z } from '@hono/zod-openapi';
import { MIN_PAX_COUNT, MIN_LEAD_TIME_DAYS, BOOKING_STATUSES } from './constants.js';
import { CateringPackageSchema } from './package.js';

export const CreateBookingSchema = z.object({
  fullName: z.string().min(2, 'Full name is required (min 2 characters)').openapi({ example: 'Maria Santos' }),
  contactNumber: z.string().regex(/^(09|\+639)\d{9}$/, 'Must be a valid Philippine mobile number (e.g. 09171234567 or +639171234567)').openapi({ example: '09171234567' }),
  email: z.string().email('Invalid email address').openapi({ example: 'maria.santos@example.com' }),
  packageId: z.number().int().positive('A valid catering package must be selected').openapi({ example: 1 }),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Event date must be in YYYY-MM-DD format').refine((val) => {
    const target = new Date(val + 'T00:00:00');
    if (isNaN(target.getTime())) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const minLead = new Date(today);
    minLead.setDate(minLead.getDate() + MIN_LEAD_TIME_DAYS);
    return target >= minLead;
  }, `Event date must be at least ${MIN_LEAD_TIME_DAYS} days in advance`).openapi({ example: '2026-10-30' }),
  venueLocation: z.string().min(5, 'Venue location is required (min 5 characters)').openapi({ example: 'Hiyas Convention Center, Malolos, Bulacan' }),
  guestCount: z.number().int().min(MIN_PAX_COUNT, `Minimum guest count is ${MIN_PAX_COUNT} pax`).openapi({ example: 100 }),
  designThemeNotes: z.string().max(1000).optional().openapi({ example: 'Rustic garden theme with pastel floral accents' }),
  referenceImageUrl: z.string().url('Must be a valid URL').optional().openapi({ example: 'https://images.unsplash.com/photo-1519741497674-611481863552' }),
}).openapi('CreateBookingInput');

export const CustomerInfoSchema = z.object({
  customerId: z.number().int().openapi({ example: 1 }),
  fullName: z.string().openapi({ example: 'Maria Santos' }),
  contactNumber: z.string().openapi({ example: '09171234567' }),
  email: z.string().email().openapi({ example: 'maria.santos@example.com' }),
  createdAt: z.string().optional().openapi({ example: '2026-09-01T12:00:00Z' }),
}).openapi('CustomerInfo');

export const BookingRecordSchema = z.object({
  bookingId: z.number().int().openapi({ example: 1 }),
  customerId: z.number().int().openapi({ example: 1 }),
  packageId: z.number().int().openapi({ example: 1 }),
  approvedBy: z.number().int().nullable().optional().openapi({ example: null }),
  eventDate: z.string().openapi({ example: '2026-10-30' }),
  venueLocation: z.string().openapi({ example: 'Hiyas Convention Center, Malolos, Bulacan' }),
  guestCount: z.number().int().openapi({ example: 100 }),
  designThemeNotes: z.string().nullable().optional().openapi({ example: 'Rustic garden theme' }),
  referenceImageUrl: z.string().nullable().optional().openapi({ example: null }),
  trackingToken: z.string().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
  status: z.enum(BOOKING_STATUSES).openapi({ example: 'Pending' }),
  createdAt: z.string().openapi({ example: '2026-09-01T12:00:00Z' }),
  updatedAt: z.string().openapi({ example: '2026-09-01T12:00:00Z' }),
  customer: CustomerInfoSchema.optional(),
  package: CateringPackageSchema.optional(),
}).openapi('BookingRecord');

export const CreateBookingResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: z.object({
    bookingId: z.number().int().openapi({ example: 1 }),
    trackingToken: z.string().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    status: z.enum(BOOKING_STATUSES).openapi({ example: 'Pending' }),
  }),
}).openapi('CreateBookingResponse');

export const BookingDetailResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: BookingRecordSchema,
}).openapi('BookingDetailResponse');

export const BookingListResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: z.array(BookingRecordSchema),
}).openapi('BookingListResponse');

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES).openapi({ example: 'Confirmed' }),
  notes: z.string().optional().openapi({ example: 'Confirmed after initial phone consultation.' }),
}).openapi('UpdateBookingStatusInput');

export const BookingFilterQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional().openapi({
    param: { name: 'status', in: 'query' },
    example: 'Pending',
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({
    param: { name: 'startDate', in: 'query' },
    example: '2026-09-01',
  }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({
    param: { name: 'endDate', in: 'query' },
    example: '2026-12-31',
  }),
}).openapi('BookingFilterQuery');

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type CustomerInfo = z.infer<typeof CustomerInfoSchema>;
export type BookingRecord = z.infer<typeof BookingRecordSchema>;
export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;
export type BookingDetailResponse = z.infer<typeof BookingDetailResponseSchema>;
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;
export type BookingFilterQuery = z.infer<typeof BookingFilterQuerySchema>;
