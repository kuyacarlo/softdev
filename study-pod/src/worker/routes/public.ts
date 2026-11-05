import { Hono } from 'hono';
import { z } from 'zod';
import { DAY, addDays, epochToLocal } from '../lib/time.js';
import { v } from '../lib/validate.js';
import { searchAvailability } from '../services/availability.js';
import { getPod, listLocations, listPods } from '../services/pods.js';
import { getSettings } from '../services/settings.js';
import type { AppEnv } from '../types.js';

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/config', async (c) => {
  const svc = c.get('svc');
  const settings = await getSettings(svc.db);
  const now = svc.now();
  const local = epochToLocal(now, svc.tz);
  return c.json({
    appName: c.env.APP_NAME || 'StudyPod',
    timezone: svc.tz,
    now,
    today: local.date,
    nowTime: local.time,
    maxDate: epochToLocal(now + settings.policy.maxAdvanceDays * DAY, svc.tz).date,
    bookableDates: Array.from({ length: settings.policy.maxAdvanceDays + 1 }, (_, i) => addDays(local.date, i)),
    policy: settings.policy,
    operatingHours: settings.operatingHours,
    locations: await listLocations(svc.db),
    authMode: c.env.AUTH_MODE === 'dev' ? 'dev' : 'oidc',
  });
});

publicRoutes.get('/pods', async (c) => c.json({ pods: await listPods(c.env.DB) }));

publicRoutes.get('/pods/:id', v('param', z.object({ id: z.coerce.number().int().positive() })), async (c) =>
  c.json({ pod: await getPod(c.env.DB, c.req.valid('param').id) }),
);

const availabilityQuery = z.object({
  date: z.string(),
  startTime: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  building: z.string().optional(),
  floor: z.coerce.number().int().optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
});

/** SRS 3.2.1 — public availability search (no personal data is exposed). */
publicRoutes.get('/availability', v('query', availabilityQuery), async (c) => {
  const q = c.req.valid('query');
  return c.json(
    await searchAvailability(c.get('svc'), {
      ...q,
      building: q.building || undefined,
    }),
  );
});
