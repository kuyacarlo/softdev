import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { AppContext } from '../types/env.js';
import type { AdminRole, AdminUser } from '@stella/schema';

// Middleware to verify JWT authentication for admin routes
export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Bearer token missing.',
      },
      401
    );
  }

  const token = authHeader.substring(7);

  try {
    const payload = (await verify(token, c.env.JWT_SECRET, 'HS256')) as unknown as {
      adminId: number;
      username: string;
      email: string;
      role: AdminRole;
    };

    const user: AdminUser = {
      adminId: payload.adminId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };

    c.set('user', user);
    await next();
  } catch {
    return c.json(
      {
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token.',
      },
      401
    );
  }
});

// Middleware to enforce specific admin roles
export function requireRoles(allowedRoles: AdminRole[]) {
  return createMiddleware<AppContext>(async (c, next) => {
    const user = c.get('user');

    if (!user || !allowedRoles.includes(user.role)) {
      return c.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'Insufficient permissions to perform this action.',
        },
        403
      );
    }

    await next();
  });
}
