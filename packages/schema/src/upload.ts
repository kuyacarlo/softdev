import { z } from '@hono/zod-openapi';

export const PresignedUploadRequestSchema = z.object({
  filename: z.string().min(1).openapi({ example: 'wedding-inspiration.jpg' }),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|avif)$/, 'Only JPEG, PNG, WebP, and AVIF image formats are allowed').openapi({ example: 'image/jpeg' }),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024, 'File size must not exceed 5MB').openapi({ example: 2048576 }),
}).openapi('PresignedUploadRequest');

export const PresignedUploadResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: z.object({
    uploadUrl: z.string().openapi({ example: '/api/uploads/direct/abcd1234.jpg' }),
    publicUrl: z.string().openapi({ example: 'https://media.stellascatering.com/uploads/abcd1234.jpg' }),
    key: z.string().openapi({ example: 'uploads/abcd1234.jpg' }),
  }),
}).openapi('PresignedUploadResponse');

export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
