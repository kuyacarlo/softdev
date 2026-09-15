import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { sign } from 'hono/jwt';
import { compareSync, hashSync } from 'bcrypt-ts';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { administrators } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppContext } from '../types/env.js';
import {
  AdminLoginSchema,
  LoginResponseSchema,
  CurrentUserResponseSchema,
  ErrorResponseSchema,
  type AdminRole,
} from '@stella/schema';

export const authRoutes = new OpenAPIHono<AppContext>();

// OpenAPI route definition for Admin Login
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'Admin Login',
  description: 'Authenticates administrative staff and returns a signed JWT token.',
  request: {
    body: {
      content: { 'application/json': { schema: AdminLoginSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: LoginResponseSchema } },
      description: 'Login successful',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid credentials',
    },
  },
});

// Admin login handler
authRoutes.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Query administrator by username
  let admin = await db.query.administrators.findFirst({
    where: eq(administrators.username, username),
  });

  // Seed default admin in development if table is empty
  if (!admin && username === 'admin' && password === 'admin123') {
    const adminCount = await db.select().from(administrators);
    if (adminCount.length === 0) {
      const defaultHash = hashSync('admin123', 10);
      const [seededAdmin] = await db
        .insert(administrators)
        .values({
          username: 'admin',
          passwordHash: defaultHash,
          email: 'admin@stellascatering.com',
          role: 'Owner',
        })
        .returning();
      admin = seededAdmin;
    }
  }

  if (!admin || !compareSync(password, admin.passwordHash)) {
    return c.json(
      {
        success: false as const,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      },
      401
    );
  }

  // Generate signed JWT token valid for 7 days
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const token = await sign(
    {
      adminId: admin.adminId,
      username: admin.username,
      email: admin.email,
      role: admin.role as AdminRole,
      exp,
    },
    c.env.JWT_SECRET,
    'HS256'
  );

  return c.json(
    {
      success: true as const,
      data: {
        token,
        user: {
          adminId: admin.adminId,
          username: admin.username,
          email: admin.email,
          role: admin.role as AdminRole,
          createdAt: admin.createdAt,
        },
      },
    },
    200
  );
});

// OpenAPI route definition for Current User Profile
const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Authentication'],
  summary: 'Get Current Authenticated User',
  description: 'Returns profile metadata of currently authenticated administrator.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: CurrentUserResponseSchema } },
      description: 'Authenticated user profile',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

// Current user profile handler
authRoutes.use('/me', requireAuth);
authRoutes.openapi(meRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false as const,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
      401
    );
  }

  return c.json(
    {
      success: true as const,
      data: user,
    },
    200
  );
});
