import { all } from '../lib/db.js';
import { badRequest } from '../lib/errors.js';
import {
  DAY,
  MINUTE,
  SLOT_MINUTES,
  addDays,
  epochToLocal,
  floorToSlot,
  isValidDate,
  isValidTime,
  localToEpoch,
  minutesToTime,
  timeToMinutes,
  weekdayOf,
} from '../lib/time.js';
import type { Services } from './context.js';
import { sweep } from './jobs.js';
import { toPod, type Pod, type PodRow } from './repo.js';
import { getSettings, type DayHours, type Settings } from './settings.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface SlotRequest {
  date: string;
  startTime: string;
  durationMinutes: number;
}

export interface ResolvedSlot {
  startAt: number;
  endAt: number;
  slotStarts: number[];
}

export function hoursFor(settings: Settings, date: string): DayHours | null {
  return settings.operatingHours[String(weekdayOf(date))] ?? null;
}

/**
 * Validate a requested time window against policy (duration limits, operating
 * hours, not in the past, advance-booking limit) and expand it into 15-minute slots.
 */
export function resolveSlot(
  settings: Settings,
  tz: string,
  now: number,
  req: SlotRequest,
  opts: { enforceAdvanceLimit: boolean } = { enforceAdvanceLimit: true },
): ResolvedSlot {
  const { policy } = settings;
  if (!isValidDate(req.date)) throw badRequest('INVALID_DATE', 'Please choose a valid date.');
  if (!isValidTime(req.startTime)) throw badRequest('INVALID_TIME', 'Please choose a valid start time (HH:MM).');
  const startMin = timeToMinutes(req.startTime);
  if (startMin % SLOT_MINUTES !== 0) {
    throw badRequest('INVALID_TIME', `Start times must be on a ${SLOT_MINUTES}-minute boundary (e.g. 14:00, 14:15).`);
  }
  const d = req.durationMinutes;
  if (!Number.isInteger(d) || d % SLOT_MINUTES !== 0 || d < policy.minDurationMinutes || d > policy.maxDurationMinutes) {
    throw badRequest(
      'DURATION_OUT_OF_RANGE',
      `Reservations must be between ${formatDuration(policy.minDurationMinutes)} and ${formatDuration(
        policy.maxDurationMinutes,
      )} long, in ${SLOT_MINUTES}-minute steps.`,
    );
  }
  const hours = hoursFor(settings, req.date);
  if (!hours) {
    throw badRequest('LIBRARY_CLOSED', `The library is closed on ${WEEKDAYS[weekdayOf(req.date)]}s. Please pick another day.`);
  }
  if (startMin < timeToMinutes(hours.open) || startMin + d > timeToMinutes(hours.close)) {
    throw badRequest(
      'OUTSIDE_OPERATING_HOURS',
      `On ${WEEKDAYS[weekdayOf(req.date)]}s pods can be booked between ${hours.open} and ${hours.close}. Please choose a time inside those hours.`,
    );
  }
  const startAt = localToEpoch(req.date, req.startTime, tz);
  const endAt = startAt + d * MINUTE;
  if (startAt < floorToSlot(now, tz)) {
    throw badRequest('TIME_IN_PAST', 'That time has already passed. Please choose a later start time.');
  }
  if (opts.enforceAdvanceLimit && startAt > now + policy.maxAdvanceDays * DAY) {
    throw badRequest(
      'TOO_FAR_IN_ADVANCE',
      `Reservations can be made at most ${policy.maxAdvanceDays} days in advance.`,
    );
  }
  const slotStarts: number[] = [];
  for (let t = startAt; t < endAt; t += SLOT_MINUTES * MINUTE) slotStarts.push(t);
  return { startAt, endAt, slotStarts };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} minutes`;
  if (!m) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

export interface AvailabilityQuery {
  date: string;
  startTime?: string;
  durationMinutes?: number;
  building?: string;
  floor?: number;
  minCapacity?: number;
}

export interface PodTimeline {
  pod: Pod;
  /** Local "HH:MM" start of every booked 15-minute slot that day. */
  busy: string[];
  available: boolean | null;
}

export interface Suggestions {
  alternativeTimes: { startTime: string; availableCount: number }[];
  alternativeLocations: Pod[];
}

export interface AvailabilityResult {
  date: string;
  hours: DayHours | null;
  query: AvailabilityQuery;
  pods: PodTimeline[];
  available: Pod[];
  suggestions: Suggestions | null;
}

function matches(p: PodRow, q: AvailabilityQuery, relaxLocation = false): boolean {
  if (p.status !== 'active') return false;
  if (q.minCapacity && p.capacity < q.minCapacity) return false;
  if (!relaxLocation) {
    if (q.building && p.building !== q.building) return false;
    if (q.floor !== undefined && p.floor !== q.floor) return false;
  }
  return true;
}

/** SRS 3.2.1 — find open pods, with nearest-alternative suggestions when nothing matches. */
export async function searchAvailability(svc: Services, q: AvailabilityQuery): Promise<AvailabilityResult> {
  if (!isValidDate(q.date)) throw badRequest('INVALID_DATE', 'Please choose a valid date.');
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const now = svc.now();
  const tz = svc.tz;

  const allPods = await all<PodRow>(svc.db, `SELECT * FROM study_pod WHERE status = 'active' ORDER BY building, floor, label`);
  const dayStart = localToEpoch(q.date, '00:00', tz);
  const dayEnd = localToEpoch(addDays(q.date, 1), '00:00', tz);
  const busyRows = await all<{ pod_id: number; slot_start_at: number }>(
    svc.db,
    `SELECT pod_id, slot_start_at FROM pod_slot WHERE slot_start_at >= ? AND slot_start_at < ?`,
    dayStart,
    dayEnd,
  );
  const busy = new Map<number, Set<number>>();
  for (const b of busyRows) {
    if (!busy.has(b.pod_id)) busy.set(b.pod_id, new Set());
    busy.get(b.pod_id)!.add(b.slot_start_at);
  }
  const isFree = (podId: number, slots: number[]) => {
    const set = busy.get(podId);
    return !set || slots.every((s) => !set.has(s));
  };

  const filtered = allPods.filter((p) => matches(p, q));
  const hours = hoursFor(settings, q.date);

  let slot: ResolvedSlot | null = null;
  if (q.startTime && q.durationMinutes) {
    slot = resolveSlot(settings, tz, now, {
      date: q.date,
      startTime: q.startTime,
      durationMinutes: q.durationMinutes,
    });
  }

  const pods: PodTimeline[] = filtered.map((p) => ({
    pod: toPod(p),
    busy: [...(busy.get(p.id) ?? [])].sort((a, b) => a - b).map((t) => epochToLocal(t, tz).time),
    available: slot ? isFree(p.id, slot.slotStarts) : null,
  }));
  const available = pods.filter((p) => p.available).map((p) => p.pod);

  let suggestions: Suggestions | null = null;
  if (slot && available.length === 0 && hours) {
    const startMin = timeToMinutes(q.startTime!);
    const d = q.durationMinutes!;
    const candidates: { startTime: string; availableCount: number; delta: number }[] = [];
    for (let k = 1; k <= 16; k++) {
      for (const sign of [-1, 1]) {
        const m = startMin + sign * k * SLOT_MINUTES;
        if (m < timeToMinutes(hours.open) || m + d > timeToMinutes(hours.close)) continue;
        const startAt = localToEpoch(q.date, minutesToTime(m), tz);
        if (startAt < floorToSlot(now, tz) || startAt > now + settings.policy.maxAdvanceDays * DAY) continue;
        const slots = Array.from({ length: d / SLOT_MINUTES }, (_, i) => startAt + i * SLOT_MINUTES * MINUTE);
        const count = filtered.filter((p) => isFree(p.id, slots)).length;
        if (count > 0) candidates.push({ startTime: minutesToTime(m), availableCount: count, delta: k });
      }
    }
    candidates.sort((a, b) => a.delta - b.delta || a.startTime.localeCompare(b.startTime));
    const alternativeLocations = allPods
      .filter((p) => matches(p, q, true) && !filtered.includes(p) && isFree(p.id, slot!.slotStarts))
      .slice(0, 5)
      .map(toPod);
    suggestions = {
      alternativeTimes: candidates.slice(0, 4).map(({ startTime, availableCount }) => ({ startTime, availableCount })),
      alternativeLocations,
    };
  }

  return { date: q.date, hours, query: q, pods, available, suggestions };
}
