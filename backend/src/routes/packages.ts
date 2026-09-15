import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { cateringPackages, bookings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppContext } from '../types/env.js';
import {
  CateringPackageSchema,
  CreatePackageSchema,
  UpdatePackageSchema,
  PackageResponseSchema,
  PackageListResponseSchema,
  PackageFilterQuerySchema,
  ErrorResponseSchema,
  SuccessMessageSchema,
  type EventCategory,
} from '@stella/schema';

export const packageRoutes = new OpenAPIHono<AppContext>();

// Helper to deserialize package database record
function formatPackage(pkg: typeof cateringPackages.$inferSelect) {
  let inclusionsArray: string[] | undefined = undefined;
  if (pkg.inclusions) {
    try {
      inclusionsArray = JSON.parse(pkg.inclusions);
    } catch {
      inclusionsArray = [pkg.inclusions];
    }
  }

  return {
    packageId: pkg.packageId,
    packageName: pkg.packageName,
    eventCategory: pkg.eventCategory as EventCategory,
    basePrice: pkg.basePrice,
    minPax: pkg.minPax,
    isAvailable: Boolean(pkg.isAvailable),
    inclusions: inclusionsArray,
    createdAt: pkg.createdAt,
  };
}

// 1. GET /api/packages - List catering packages
const listPackagesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Packages'],
  summary: 'Browse Catering Packages',
  description: 'Returns all catering packages with optional filtering by event category and availability.',
  request: {
    query: PackageFilterQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PackageListResponseSchema } },
      description: 'List of catering packages',
    },
  },
});

packageRoutes.openapi(listPackagesRoute, async (c) => {
  const { category, availableOnly } = c.req.valid('query');
  const db = getDb(c.env.DB);

  const filters = [];
  if (category) {
    filters.push(eq(cateringPackages.eventCategory, category));
  }
  if (availableOnly === 'true') {
    filters.push(eq(cateringPackages.isAvailable, true));
  }

  const query = filters.length > 0 ? and(...filters) : undefined;
  const packageRecords = await db.query.cateringPackages.findMany({
    where: query,
    orderBy: (pkgs, { asc }) => [asc(pkgs.packageId)],
  });

  return c.json(
    {
      success: true as const,
      data: packageRecords.map(formatPackage),
    },
    200
  );
});

// 2. GET /api/packages/:id - Get package by ID
const getPackageRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Packages'],
  summary: 'Get Catering Package Details',
  description: 'Retrieves itemized details of a single catering package.',
  request: {
    params: z.object({
      id: z.coerce.number().int().positive().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PackageResponseSchema } },
      description: 'Package details found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Package not found',
    },
  },
});

packageRoutes.openapi(getPackageRoute, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const pkg = await db.query.cateringPackages.findFirst({
    where: eq(cateringPackages.packageId, id),
  });

  if (!pkg) {
    return c.json(
      {
        success: false as const,
        error: 'NOT_FOUND',
        message: `Catering package with ID ${id} was not found.`,
      },
      404
    );
  }

  return c.json(
    {
      success: true as const,
      data: formatPackage(pkg),
    },
    200
  );
});

// 3. POST /api/packages - Create new package (Admin)
const createPackageRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Packages'],
  summary: 'Create Catering Package (Admin)',
  description: 'Adds a new catering tier to the service catalog.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreatePackageSchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: PackageResponseSchema } },
      description: 'Package created successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error or duplicate package name',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

packageRoutes.use('/', async (c, next) => {
  if (c.req.method === 'POST') return requireAuth(c, next);
  return next();
});

packageRoutes.openapi(createPackageRoute, async (c) => {
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    const [inserted] = await db
      .insert(cateringPackages)
      .values({
        packageName: data.packageName,
        eventCategory: data.eventCategory,
        basePrice: data.basePrice,
        minPax: data.minPax,
        isAvailable: data.isAvailable ?? true,
        inclusions: data.inclusions ? JSON.stringify(data.inclusions) : null,
      })
      .returning();

    return c.json(
      {
        success: true as const,
        data: formatPackage(inserted),
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return c.json(
      {
        success: false as const,
        error: 'CONFLICT',
        message: message.includes('UNIQUE') ? 'A package with this name already exists' : message,
      },
      400
    );
  }
});

// 4. PUT /api/packages/:id - Update package (Admin)
const updatePackageRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Packages'],
  summary: 'Update Catering Package (Admin)',
  description: 'Modifies pricing, minimum pax, inclusions, or availability of a package.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive().openapi({ example: 1 }),
    }),
    body: {
      content: { 'application/json': { schema: UpdatePackageSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PackageResponseSchema } },
      description: 'Package updated successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Package not found',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

packageRoutes.use('/{id}', async (c, next) => {
  if (['PUT', 'DELETE'].includes(c.req.method)) return requireAuth(c, next);
  return next();
});

packageRoutes.openapi(updatePackageRoute, async (c) => {
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const existing = await db.query.cateringPackages.findFirst({
    where: eq(cateringPackages.packageId, id),
  });

  if (!existing) {
    return c.json(
      {
        success: false as const,
        error: 'NOT_FOUND',
        message: `Package with ID ${id} does not exist.`,
      },
      404
    );
  }

  const updateValues: Record<string, unknown> = {};
  if (data.packageName !== undefined) updateValues.packageName = data.packageName;
  if (data.eventCategory !== undefined) updateValues.eventCategory = data.eventCategory;
  if (data.basePrice !== undefined) updateValues.basePrice = data.basePrice;
  if (data.minPax !== undefined) updateValues.minPax = data.minPax;
  if (data.isAvailable !== undefined) updateValues.isAvailable = data.isAvailable;
  if (data.inclusions !== undefined) updateValues.inclusions = JSON.stringify(data.inclusions);

  const [updated] = await db
    .update(cateringPackages)
    .set(updateValues)
    .where(eq(cateringPackages.packageId, id))
    .returning();

  return c.json(
    {
      success: true as const,
      data: formatPackage(updated),
    },
    200
  );
});

// 5. DELETE /api/packages/:id - Delete or deactivate package (Admin)
const deletePackageRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Packages'],
  summary: 'Delete or Deactivate Catering Package (Admin)',
  description: 'Deactivates a package if bookings reference it, or deletes it if unused.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessMessageSchema } },
      description: 'Package deleted or deactivated',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Package not found',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

packageRoutes.openapi(deletePackageRoute, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const existing = await db.query.cateringPackages.findFirst({
    where: eq(cateringPackages.packageId, id),
  });

  if (!existing) {
    return c.json(
      {
        success: false as const,
        error: 'NOT_FOUND',
        message: `Package with ID ${id} not found.`,
      },
      404
    );
  }

  // Check if existing bookings reference this package
  const linkedBookings = await db.query.bookings.findFirst({
    where: eq(bookings.packageId, id),
  });

  if (linkedBookings) {
    // Soft delete: toggle isAvailable to false
    await db
      .update(cateringPackages)
      .set({ isAvailable: false })
      .where(eq(cateringPackages.packageId, id));

    return c.json(
      {
        success: true as const,
        message: 'Package is referenced by existing bookings and has been marked as unavailable.',
      },
      200
    );
  }

  // Hard delete if not referenced
  await db.delete(cateringPackages).where(eq(cateringPackages.packageId, id));

  return c.json(
    {
      success: true as const,
      message: 'Package deleted successfully.',
    },
    200
  );
});
