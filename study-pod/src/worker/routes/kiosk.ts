import { Hono } from 'hono';
import { z } from 'zod';
import { forbidden, unauthorized } from '../lib/errors.js';
import { requireStaff, staffId } from '../lib/guards.js';
import { clearKioskSession, setKioskSession } from '../lib/session.js';
import { v } from '../lib/validate.js';
import { listPods } from '../services/pods.js';
import { kioskCheckIn } from '../services/reservations.js';
import type { AppEnv } from '../types.js';

/**
 * Shared check-in kiosk (SRS 3.1.2). A staff member activates a tablet for one
 * building; the device then holds a long-lived kiosk cookie and accepts PIN check-ins.
 */
export const kioskRoutes = new Hono<AppEnv>();

kioskRoutes.post('/session', requireStaff(), v('json', z.object({ building: z.string().min(1) })), async (c) => {
  const { building } = c.req.valid('json');
  const pods = (await listPods(c.env.DB)).filter((p) => p.building === building);
  if (!pods.length) throw forbidden(`There are no pods in "${building}".`);
  await setKioskSession(c, { building, staffId: staffId(c) });
  return c.json({ building });
});

kioskRoutes.get('/session', async (c) => {
  const kiosk = c.get('kiosk');
  if (!kiosk) throw unauthorized('This device is not set up as a check-in kiosk. Ask library staff to activate it.');
  const pods = (await listPods(c.env.DB)).filter((p) => p.building === kiosk.building && p.status === 'active');
  return c.json({ building: kiosk.building, pods });
});

kioskRoutes.delete('/session', (c) => {
  clearKioskSession(c);
  return c.json({ ok: true });
});

kioskRoutes.post(
  '/checkin',
  v('json', z.object({ podId: z.number().int().positive(), pin: z.string().regex(/^\d{6}$/, 'Enter the 6-digit PIN from your confirmation.') })),
  async (c) => {
    const kiosk = c.get('kiosk');
    const user = c.get('user');
    if (!kiosk && user?.kind !== 'staff') {
      throw unauthorized('This device is not set up as a check-in kiosk. Ask library staff to activate it.');
    }
    return c.json(await kioskCheckIn(c.get('svc'), c.req.valid('json'), kiosk?.building ?? null));
  },
);
