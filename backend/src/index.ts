import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { apiReference } from '@scalar/hono-api-reference';
import type { AppContext } from './types/env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { packageRoutes } from './routes/packages.js';
import { bookingRoutes } from './routes/bookings.js';
import { trackRoutes } from './routes/track.js';
import { uploadRoutes } from './routes/uploads.js';

// Initialize OpenAPI Hono application with Cloudflare Worker bindings
const app = new OpenAPIHono<AppContext>();

// CORS middleware setup
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = c.env?.CORS_ORIGIN || '*';
      return allowed === '*' ? '*' : origin;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
  })
);

// Global error handler for uncaught exceptions
app.onError((err, c) => {
  console.error('[Worker Error]:', err);
  return c.json(
    {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred on the server.',
    },
    500
  );
});

// Global 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${c.req.path} was not found.`,
    },
    404
  );
});

// Mount module route groups
app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/packages', packageRoutes);
app.route('/api/bookings', bookingRoutes);
app.route('/api/track', trackRoutes);
app.route('/api/uploads', uploadRoutes);

// OpenAPI JSON documentation specification
app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Casa de Stella Catering Services API',
    version: '1.0.0',
    description:
      'Cloudflare Edge API for catering package catalog, public booking intake, guest status tracking, and administrative event management.',
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment API Host',
    },
  ],
});

// Interactive Scalar API documentation UI
app.get(
  '/docs',
  apiReference({
    spec: {
      url: '/openapi.json',
    },
    pageTitle: 'Casa de Stella API Reference',
    theme: 'kepler',
  })
);

app.get('/', (c) => c.redirect('/docs'));

export default app;
