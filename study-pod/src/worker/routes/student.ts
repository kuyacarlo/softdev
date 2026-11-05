import { Hono } from 'hono';
import { z } from 'zod';
import { requireStudent, studentId } from '../lib/guards.js';
import { v } from '../lib/validate.js';
import {
  cancelReservation,
  createReservation,
  endSessionEarly,
  getStudentReservation,
  listStudentReservations,
  modifyReservation,
  studentCheckIn,
} from '../services/reservations.js';
import type { AppEnv } from '../types.js';

export const studentRoutes = new Hono<AppEnv>();
// Scoped paths (not '*') so this guard never leaks onto other routers mounted under /api.
studentRoutes.use('/reservations', requireStudent);
studentRoutes.use('/reservations/*', requireStudent);
studentRoutes.use('/checkin', requireStudent);

const slot = {
  date: z.string(),
  startTime: z.string(),
  durationMinutes: z.number().int().positive(),
};
const codeParam = z.object({ code: z.string().min(4).max(12) });

studentRoutes.get('/reservations/mine', async (c) => c.json(await listStudentReservations(c.get('svc'), studentId(c))));

studentRoutes.get('/reservations/:code', v('param', codeParam), async (c) =>
  c.json({ reservation: await getStudentReservation(c.get('svc'), studentId(c), c.req.valid('param').code) }),
);

studentRoutes.post('/reservations', v('json', z.object({ podId: z.number().int().positive(), ...slot })), async (c) =>
  c.json({ reservation: await createReservation(c.get('svc'), studentId(c), c.req.valid('json')) }, 201),
);

studentRoutes.patch(
  '/reservations/:code',
  v('param', codeParam),
  v('json', z.object({ podId: z.number().int().positive().optional(), ...slot })),
  async (c) =>
    c.json({
      reservation: await modifyReservation(c.get('svc'), studentId(c), c.req.valid('param').code, c.req.valid('json')),
    }),
);

studentRoutes.post('/reservations/:code/cancel', v('param', codeParam), async (c) =>
  c.json({ reservation: await cancelReservation(c.get('svc'), studentId(c), c.req.valid('param').code) }),
);

studentRoutes.post('/reservations/:code/end', v('param', codeParam), async (c) =>
  c.json({ reservation: await endSessionEarly(c.get('svc'), studentId(c), c.req.valid('param').code) }),
);

studentRoutes.post(
  '/checkin',
  v(
    'json',
    z
      .object({ code: z.string().min(4).max(12).optional(), podId: z.number().int().positive().optional() })
      .refine((b) => b.code || b.podId, 'Scan the QR code on your pod or enter your reservation code.'),
  ),
  async (c) => c.json(await studentCheckIn(c.get('svc'), studentId(c), c.req.valid('json'))),
);
