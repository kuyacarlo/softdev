import { z } from '@hono/zod-openapi';

export const ErrorResponseSchema = z.object({
  success: z.literal(false).openapi({ example: false }),
  error: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid request parameters' }),
  details: z.array(z.record(z.any())).optional().openapi({
    example: [{ field: 'guestCount', message: 'Minimum guest count is 30 pax' }],
  }),
}).openapi('ErrorResponse');

export const SuccessMessageSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  message: z.string().openapi({ example: 'Operation completed successfully' }),
}).openapi('SuccessMessageResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessMessageResponse = z.infer<typeof SuccessMessageSchema>;
