import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppContext } from '../types/env.js';
import {
  PresignedUploadRequestSchema,
  PresignedUploadResponseSchema,
  ErrorResponseSchema,
} from '@stella/schema';

export const uploadRoutes = new OpenAPIHono<AppContext>();

// 1. POST /api/uploads/presigned-url - Generate upload target
const presignedRoute = createRoute({
  method: 'post',
  path: '/presigned-url',
  tags: ['Media & Uploads'],
  summary: 'Request Media Upload Target',
  description: 'Generates an upload URL for theme inspiration and reference photos.',
  request: {
    body: {
      content: { 'application/json': { schema: PresignedUploadRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PresignedUploadResponseSchema } },
      description: 'Upload target generated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid file format or file size exceeded',
    },
  },
});

uploadRoutes.openapi(presignedRoute, async (c) => {
  const { filename } = c.req.valid('json');
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const key = `uploads/${crypto.randomUUID()}-${safeFilename}`;
  const publicBaseUrl = c.env.PUBLIC_R2_URL || 'https://media.stellascatering.com';

  return c.json(
    {
      success: true as const,
      data: {
        uploadUrl: `/api/uploads/direct?key=${encodeURIComponent(key)}`,
        publicUrl: `${publicBaseUrl}/${key}`,
        key,
      },
    },
    200
  );
});

// 2. Direct upload handler for Cloudflare R2
uploadRoutes.post('/direct', async (c) => {
  const key = c.req.query('key') || `uploads/${crypto.randomUUID()}.jpg`;
  const body = await c.req.arrayBuffer();
  const contentType = c.req.header('Content-Type') || 'image/jpeg';

  if (body.byteLength > 5 * 1024 * 1024) {
    return c.json(
      {
        success: false as const,
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds maximum allowable limit of 5MB.',
      },
      400
    );
  }

  // Upload to R2 Bucket if binding is available
  if (c.env.BUCKET) {
    await c.env.BUCKET.put(key, body, {
      httpMetadata: { contentType },
    });
  }

  const publicBaseUrl = c.env.PUBLIC_R2_URL || 'https://media.stellascatering.com';
  return c.json(
    {
      success: true as const,
      data: {
        key,
        publicUrl: `${publicBaseUrl}/${key}`,
      },
    },
    201
  );
});

// 3. GET /api/uploads/:key - Media streaming from R2
uploadRoutes.get('/file/:key', async (c) => {
  const key = c.req.param('key');
  if (!c.env.BUCKET) {
    return c.text('R2 storage bucket is not configured in this environment', 404);
  }

  const object = await c.env.BUCKET.get(`uploads/${key}`);
  if (!object) {
    return c.text('Media file not found', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});
