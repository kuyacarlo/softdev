import { Hono } from 'hono';
import { z } from 'zod';
import { requireStaff, staffId } from '../lib/guards.js';
import { isValidDate } from '../lib/time.js';
import { v } from '../lib/validate.js';
import { forbidden } from '../lib/errors.js';
import { all } from '../lib/db.js';
import { createStaff, findOrRegisterStudent, listStaff, updateStaff } from '../services/identity.js';
import { listNotifications } from '../services/notifications.js';
import { changePodStatus, createPod, listPods, updatePod } from '../services/pods.js';
import { exportReservationsCsv, generateReport } from '../services/reports.js';
import {
  createWalkIn,
  listAdminReservations,
  staffCancelReservation,
  staffCheckIn,
} from '../services/reservations.js';
import { getSettings, operatingHoursSchema, updateSettings } from '../services/settings.js';
import type { AppEnv } from '../types.js';

export const adminRoutes = new Hono<AppEnv>();
const manager = requireStaff(['facility_manager']);
adminRoutes.use('*', requireStaff());

const date = z.string().refine(isValidDate, 'Use a valid date (YYYY-MM-DD).');
const idParam = z.object({ id: z.coerce.number().int().positive() });
const codeParam = z.object({ code: z.string().min(4).max(12) });
const statuses = ['Confirmed', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow'] as const;

/* ---------- Reservation oversight (SRS 3.2.6) ---------- */

adminRoutes.get(
  '/reservations',
  v(
    'query',
    z.object({
      from: date.optional(),
      to: date.optional(),
      building: z.string().optional(),
      floor: z.coerce.number().int().optional(),
      status: z.enum(statuses).optional(),
      q: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(1000).optional(),
    }),
  ),
  async (c) => {
    const f = c.req.valid('query');
    return c.json({ reservations: await listAdminReservations(c.get('svc'), { ...f, building: f.building || undefined, q: f.q || undefined }) });
  },
);

adminRoutes.post(
  '/reservations/:code/cancel',
  v('param', codeParam),
  v('json', z.object({ reason: z.string().max(300).optional() })),
  async (c) =>
    c.json({
      reservation: await staffCancelReservation(
        c.get('svc'),
        staffId(c),
        c.req.valid('param').code,
        c.req.valid('json').reason?.trim() || null,
      ),
    }),
);

adminRoutes.post('/reservations/:code/check-in', v('param', codeParam), async (c) =>
  c.json(await staffCheckIn(c.get('svc'), staffId(c), c.req.valid('param').code)),
);

adminRoutes.post(
  '/walk-ins',
  v(
    'json',
    z.object({
      studentEmail: z.string().email('Enter the student’s university email.'),
      studentName: z.string().max(120).optional(),
      podId: z.number().int().positive(),
      durationMinutes: z.number().int().positive(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const svc = c.get('svc');
    const student = await findOrRegisterStudent(svc, body.studentEmail, body.studentName);
    return c.json(
      { reservation: await createWalkIn(svc, staffId(c), { studentId: student.id, podId: body.podId, durationMinutes: body.durationMinutes }) },
      201,
    );
  },
);

/* ---------- Pod inventory (SRS 3.2.5) ---------- */

const podBody = z.object({
  label: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only.'),
  name: z.string().trim().min(2).max(80),
  building: z.string().trim().min(2).max(80),
  floor: z.number().int().min(-5).max(100),
  capacity: z.number().int().min(1).max(20),
  amenities: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().max(500).nullable().optional(),
});

adminRoutes.get('/pods', async (c) => c.json({ pods: await listPods(c.env.DB, { includeRetired: true }) }));

adminRoutes.post('/pods', manager, v('json', podBody), async (c) =>
  c.json({ pod: await createPod(c.get('svc'), staffId(c), c.req.valid('json')) }, 201),
);

adminRoutes.patch('/pods/:id', manager, v('param', idParam), v('json', podBody.partial()), async (c) =>
  c.json({ pod: await updatePod(c.get('svc'), staffId(c), c.req.valid('param').id, c.req.valid('json')) }),
);

adminRoutes.post(
  '/pods/:id/status',
  v('param', idParam),
  v(
    'json',
    z.object({
      status: z.enum(['active', 'maintenance', 'retired']),
      cancelReservations: z.enum(['none', 'window', 'all']).optional(),
      reason: z.string().max(300).optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    // Front-desk staff may flag a pod for maintenance (and back); retiring is a Facility Manager decision.
    if (user?.kind === 'staff' && user.role !== 'facility_manager' && body.status === 'retired') {
      throw forbidden('Only a Facility Manager can retire a pod.');
    }
    return c.json(await changePodStatus(c.get('svc'), staffId(c), c.req.valid('param').id, body.status, body));
  },
);

/* ---------- Reports (SRS 3.2.6) ---------- */

const reportQuery = z.object({
  from: date,
  to: date,
  building: z.string().optional(),
  floor: z.coerce.number().int().optional(),
});

adminRoutes.get('/reports', manager, v('query', reportQuery), async (c) => {
  const q = c.req.valid('query');
  return c.json(await generateReport(c.get('svc'), { ...q, building: q.building || undefined }));
});

adminRoutes.get('/reports/export.csv', manager, v('query', reportQuery), async (c) => {
  const q = c.req.valid('query');
  const csv = await exportReservationsCsv(c.get('svc'), { ...q, building: q.building || undefined });
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="studypod-reservations-${q.from}-to-${q.to}.csv"`,
  });
});

/* ---------- Settings (SRS 3.5.5) ---------- */

adminRoutes.get('/settings', async (c) => c.json(await getSettings(c.env.DB)));

adminRoutes.put(
  '/settings',
  manager,
  v(
    'json',
    z.object({
      policy: z.record(z.number()).optional(),
      operatingHours: operatingHoursSchema.optional(),
    }),
  ),
  async (c) => c.json(await updateSettings(c.get('svc'), staffId(c), c.req.valid('json'))),
);

/* ---------- Staff accounts, outbox, audit ---------- */

const role = z.enum(['facility_manager', 'front_desk']);

adminRoutes.get('/staff', manager, async (c) => c.json({ staff: await listStaff(c.env.DB) }));

adminRoutes.post(
  '/staff',
  manager,
  v('json', z.object({ name: z.string().trim().min(2).max(120), email: z.string().email(), role })),
  async (c) => c.json({ staff: await createStaff(c.get('svc'), staffId(c), c.req.valid('json')) }, 201),
);

adminRoutes.patch(
  '/staff/:id',
  manager,
  v('param', idParam),
  v('json', z.object({ role: role.optional(), active: z.boolean().optional(), name: z.string().max(120).optional() })),
  async (c) => c.json({ staff: await updateStaff(c.get('svc'), staffId(c), c.req.valid('param').id, c.req.valid('json')) }),
);

adminRoutes.get('/notifications', async (c) => c.json({ notifications: await listNotifications(c.env.DB) }));

adminRoutes.get('/audit', manager, async (c) => {
  const rows = await all<Record<string, unknown>>(c.env.DB, `SELECT * FROM audit_log ORDER BY id DESC LIMIT 200`);
  return c.json({ entries: rows });
});
