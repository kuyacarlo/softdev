import { z } from '@hono/zod-openapi';
import { EVENT_CATEGORIES } from './constants.js';

export const CateringPackageSchema = z.object({
  packageId: z.number().int().openapi({ example: 1 }),
  packageName: z.string().min(3).openapi({ example: 'Grand Emerald Wedding Package' }),
  eventCategory: z.enum(EVENT_CATEGORIES).openapi({ example: 'Wedding' }),
  basePrice: z.number().positive().openapi({ example: 45000.0 }),
  minPax: z.number().int().min(30).openapi({ example: 50 }),
  isAvailable: z.boolean().openapi({ example: true }),
  inclusions: z.array(z.string()).optional().openapi({
    example: ['5-course buffet', 'Thematic backdrop setup', 'Uniformed waitstaff', 'Sound system'],
  }),
  createdAt: z.string().optional().openapi({ example: '2026-09-01T12:00:00Z' }),
}).openapi('CateringPackage');

export const CreatePackageSchema = CateringPackageSchema.omit({
  packageId: true,
  createdAt: true,
}).openapi('CreatePackageInput');

export const UpdatePackageSchema = CreatePackageSchema.partial().openapi('UpdatePackageInput');

export const PackageResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: CateringPackageSchema,
}).openapi('PackageResponse');

export const PackageListResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: z.array(CateringPackageSchema),
}).openapi('PackageListResponse');

export const PackageFilterQuerySchema = z.object({
  category: z.enum(EVENT_CATEGORIES).optional().openapi({
    param: { name: 'category', in: 'query' },
    example: 'Wedding',
  }),
  availableOnly: z.enum(['true', 'false']).optional().openapi({
    param: { name: 'availableOnly', in: 'query' },
    example: 'true',
  }),
}).openapi('PackageFilterQuery');

export type CateringPackage = z.infer<typeof CateringPackageSchema>;
export type CreatePackageInput = z.infer<typeof CreatePackageSchema>;
export type UpdatePackageInput = z.infer<typeof UpdatePackageSchema>;
export type PackageResponse = z.infer<typeof PackageResponseSchema>;
export type PackageListResponse = z.infer<typeof PackageListResponseSchema>;
export type PackageFilterQuery = z.infer<typeof PackageFilterQuerySchema>;
