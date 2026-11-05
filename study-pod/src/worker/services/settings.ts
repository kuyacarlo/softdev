import { z } from 'zod';
import { all, run } from '../lib/db.js';
import { badRequest } from '../lib/errors.js';
import { SLOT_MINUTES, isValidTime, timeToMinutes } from '../lib/time.js';
import type { Services } from './context.js';

/**
 * Reservation policy (SRS 3.2.2–3.2.4, 3.6, 3.9). Stored in the `setting` table so
 * staff can change it from the admin console without a code change (SRS 3.5.5).
 */
export interface Policy {
  minDurationMinutes: number;
  maxDurationMinutes: number;
  gracePeriodMinutes: number;
  earlyCheckInMinutes: number;
  modifyCutoffMinutes: number;
  reminderLeadMinutes: number;
  maxAdvanceDays: number;
  retireConflictWindowHours: number;
}

export interface DayHours {
  open: string;
  close: string;
}

/** Keyed by weekday "0" (Sunday) … "6" (Saturday); null = closed. */
export type OperatingHours = Record<string, DayHours | null>;

export interface Settings {
  policy: Policy;
  operatingHours: OperatingHours;
}

export const DEFAULT_POLICY: Policy = {
  minDurationMinutes: 30,
  maxDurationMinutes: 180,
  gracePeriodMinutes: 10,
  earlyCheckInMinutes: 10,
  modifyCutoffMinutes: 15,
  reminderLeadMinutes: 15,
  maxAdvanceDays: 7,
  retireConflictWindowHours: 24,
};

const weekday = { open: '07:00', close: '21:00' };
export const DEFAULT_HOURS: OperatingHours = {
  '0': { open: '09:00', close: '17:00' },
  '1': weekday,
  '2': weekday,
  '3': weekday,
  '4': weekday,
  '5': weekday,
  '6': { open: '08:00', close: '18:00' },
};

const slotMultiple = (label: string) =>
  z
    .number()
    .int()
    .refine((v) => v % SLOT_MINUTES === 0, `${label} must be a multiple of ${SLOT_MINUTES} minutes.`);

export const policySchema = z
  .object({
    minDurationMinutes: slotMultiple('Minimum duration').pipe(z.number().min(SLOT_MINUTES).max(24 * 60)),
    maxDurationMinutes: slotMultiple('Maximum duration').pipe(z.number().min(SLOT_MINUTES).max(24 * 60)),
    gracePeriodMinutes: z.number().int().min(1).max(60),
    earlyCheckInMinutes: z.number().int().min(0).max(60),
    modifyCutoffMinutes: z.number().int().min(0).max(24 * 60),
    reminderLeadMinutes: z.number().int().min(0).max(24 * 60),
    maxAdvanceDays: z.number().int().min(0).max(60),
    retireConflictWindowHours: z.number().int().min(1).max(24 * 14),
  })
  .refine((p) => p.minDurationMinutes <= p.maxDurationMinutes, {
    message: 'Minimum duration cannot be longer than the maximum duration.',
  })
  .refine((p) => p.gracePeriodMinutes < p.minDurationMinutes, {
    message: 'The check-in grace period must be shorter than the minimum reservation length.',
  });

const dayHoursSchema = z
  .object({
    open: z.string().refine(isValidTime, 'Use HH:MM (24-hour) for opening time.'),
    close: z.string().refine(isValidTime, 'Use HH:MM (24-hour) for closing time.'),
  })
  .refine((h) => timeToMinutes(h.open) % SLOT_MINUTES === 0 && timeToMinutes(h.close) % SLOT_MINUTES === 0, {
    message: `Opening and closing times must fall on ${SLOT_MINUTES}-minute boundaries.`,
  })
  .refine((h) => timeToMinutes(h.open) < timeToMinutes(h.close), {
    message: 'Closing time must be after opening time.',
  });

export const operatingHoursSchema = z.object(
  Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, dayHoursSchema.nullable()])) as Record<
    string,
    z.ZodNullable<typeof dayHoursSchema>
  >,
);

export async function getSettings(db: D1Database): Promise<Settings> {
  const rows = await all<{ key: string; value: string }>(db, `SELECT key, value FROM setting`);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const policy = { ...DEFAULT_POLICY, ...(map.has('policy') ? JSON.parse(map.get('policy')!) : {}) } as Policy;
  const operatingHours = map.has('operating_hours')
    ? (JSON.parse(map.get('operating_hours')!) as OperatingHours)
    : DEFAULT_HOURS;
  return { policy, operatingHours };
}

export async function updateSettings(
  svc: Services,
  staffId: number,
  input: { policy?: Partial<Policy>; operatingHours?: OperatingHours },
): Promise<Settings> {
  const current = await getSettings(svc.db);
  const now = svc.now();
  if (input.policy) {
    const merged = policySchema.safeParse({ ...current.policy, ...input.policy });
    if (!merged.success) throw badRequest('INVALID_POLICY', merged.error.issues[0].message);
    await run(
      svc.db,
      `INSERT INTO setting (key, value, updated_at, updated_by_staff_id) VALUES ('policy', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
         updated_by_staff_id = excluded.updated_by_staff_id`,
      JSON.stringify(merged.data),
      now,
      staffId,
    );
  }
  if (input.operatingHours) {
    const parsed = operatingHoursSchema.safeParse(input.operatingHours);
    if (!parsed.success) throw badRequest('INVALID_HOURS', parsed.error.issues[0].message);
    await run(
      svc.db,
      `INSERT INTO setting (key, value, updated_at, updated_by_staff_id) VALUES ('operating_hours', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
         updated_by_staff_id = excluded.updated_by_staff_id`,
      JSON.stringify(parsed.data),
      now,
      staffId,
    );
  }
  return getSettings(svc.db);
}
