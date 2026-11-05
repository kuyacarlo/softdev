import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './env.js';
import { mailerFromEnv, type Mailer } from './lib/email.js';
import { AppError, forbidden } from './lib/errors.js';
import { readKioskSession, readSession } from './lib/session.js';
import { isValidTimeZone } from './lib/time.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { kioskRoutes } from './routes/kiosk.js';
import { publicRoutes } from './routes/public.js';
import { studentRoutes } from './routes/student.js';
import type { Services } from './services/context.js';
import type { AppEnv } from './types.js';

export interface AppOptions {
  /** Clock override (tests). */
  now?: () => number;
  /** Mailer override (tests). */
  mailer?: Mailer;
}

export const CLIENT_HEADER = 'X-StudyPod-Client';

export function buildServices(env: Env, opts: AppOptions, defer: (p: Promise<unknown>) => void, origin: string): Services {
  const tz = env.CAMPUS_TZ && isValidTimeZone(env.CAMPUS_TZ) ? env.CAMPUS_TZ : 'Asia/Manila';
  return {
    db: env.DB,
    env,
    tz,
    now: opts.now ?? (() => Date.now()),
    mailer: opts.mailer ?? mailerFromEnv(env),
    appUrl: (env.APP_URL || origin).replace(/\/$/, ''),
    defer,
  };
}

export function createApp(opts: AppOptions = {}) {
  const app = new Hono<AppEnv>();

  app.use('/api/*', secureHeaders());

  // Per-request services + deferred work (emails) that must not block the response.
  app.use('/api/*', async (c, next) => {
    const pending: Promise<unknown>[] = [];
    let ctx: { waitUntil(p: Promise<unknown>): void } | null = null;
    try {
      ctx = c.executionCtx;
    } catch {
      ctx = null;
    }
    const defer = (p: Promise<unknown>) => {
      const safe = p.catch((err) => console.error('[deferred]', err));
      if (ctx) ctx.waitUntil(safe);
      else pending.push(safe);
    };
    c.set('svc', buildServices(c.env, opts, defer, new URL(c.req.url).origin));
    await next();
    if (pending.length) await Promise.all(pending);
  });

  // CSRF defence: state-changing requests must carry a custom header, which browsers
  // only send cross-origin after a CORS preflight that this API never approves.
  app.use('/api/*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !c.req.header(CLIENT_HEADER)) {
      throw forbidden('This request was blocked for your security. Please use the StudyPod website.');
    }
    await next();
  });

  app.use('/api/*', async (c, next) => {
    c.set('user', await readSession(c));
    c.set('kiosk', await readKioskSession(c));
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true, time: c.get('svc').now() }));
  app.route('/api/auth', authRoutes);
  app.route('/api/admin', adminRoutes);
  app.route('/api/kiosk', kioskRoutes);
  app.route('/api', publicRoutes);
  app.route('/api', studentRoutes);

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: "That page or action doesn't exist." } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } },
        err.status as 400,
      );
    }
    console.error('[unhandled]', err);
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again in a moment.' } },
      500,
    );
  });

  return app;
}
