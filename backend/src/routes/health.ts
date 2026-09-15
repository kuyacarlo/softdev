import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppContext } from '../types/env.js';

export const healthRoutes = new OpenAPIHono<AppContext>();

const HealthResponseSchema = z.object({
  status: z.string().openapi({ example: 'healthy' }),
  timestamp: z.string().openapi({ example: '2026-09-15T09:00:00Z' }),
  environment: z.string().openapi({ example: 'development' }),
}).openapi('HealthResponse');

const getHealth = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'API Health Check',
  description: 'Returns the operational health status and runtime environment of the Worker.',
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponseSchema } },
      description: 'System operational status',
    },
  },
});

// Health route handler
healthRoutes.openapi(getHealth, (c) => {
  return c.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'development',
    },
    200
  );
});
