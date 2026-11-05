import { all } from '../lib/db.js';
import { badRequest } from '../lib/errors.js';
import { MINUTE, addDays, daysBetween, epochToLocal, isValidDate, timeToMinutes, weekdayOf } from '../lib/time.js';
import type { Services } from './context.js';
import { RESERVATION_SELECT, type ReservationJoined } from './repo.js';
import { getSettings, type OperatingHours } from './settings.js';

export interface ReportQuery {
  from: string;
  to: string;
  building?: string;
  floor?: number;
}

interface Bucket {
  reservations: number;
  checkedIn: number;
  noShows: number;
  cancelled: number;
  bookedMinutes: number;
  usedMinutes: number;
  capacityMinutes: number;
}

const emptyBucket = (): Bucket => ({
  reservations: 0,
  checkedIn: 0,
  noShows: 0,
  cancelled: 0,
  bookedMinutes: 0,
  usedMinutes: 0,
  capacityMinutes: 0,
});

function finish(b: Bucket) {
  const resolved = b.checkedIn + b.noShows;
  return {
    ...b,
    noShowRate: resolved ? b.noShows / resolved : 0,
    cancellationRate: b.reservations ? b.cancelled / b.reservations : 0,
    occupancyRate: b.capacityMinutes ? b.usedMinutes / b.capacityMinutes : 0,
    bookingRate: b.capacityMinutes ? b.bookedMinutes / b.capacityMinutes : 0,
  };
}

function operatingMinutes(hours: OperatingHours, date: string): number {
  const h = hours[String(weekdayOf(date))];
  return h ? timeToMinutes(h.close) - timeToMinutes(h.open) : 0;
}

/** Minutes the student actually held the pod (check-in → end or early check-out). */
function usedMinutes(r: ReservationJoined): number {
  if (r.status !== 'CheckedIn' && r.status !== 'Completed') return 0;
  const end = r.ended_early_at ? Math.min(r.ended_early_at, r.end_at) : r.end_at;
  return Math.max(0, Math.round((end - r.start_at) / MINUTE));
}

/**
 * SRS 3.2.6 — utilization statistics: occupancy rate, no-show rate and peak-hour
 * demand, overall, per building and per day.
 *
 * - occupancy rate = minutes pods were actually used ÷ pod-minutes open in the range
 * - booking rate   = minutes reserved (excluding cancellations / no-shows) ÷ pod-minutes open
 * - no-show rate   = no-shows ÷ (no-shows + check-ins) among reservations that reached their start
 */
export async function generateReport(svc: Services, q: ReportQuery) {
  if (!isValidDate(q.from) || !isValidDate(q.to)) throw badRequest('INVALID_DATE', 'Please choose a valid date range.');
  if (q.from > q.to) throw badRequest('INVALID_RANGE', 'The start date must be on or before the end date.');
  const span = daysBetween(q.from, q.to) + 1;
  if (span > 366) throw badRequest('RANGE_TOO_LONG', 'Reports can cover at most one year at a time.');

  const { operatingHours } = await getSettings(svc.db);

  const podWhere: string[] = [`status != 'retired'`];
  const podParams: unknown[] = [];
  const resWhere: string[] = ['r.date >= ?', 'r.date <= ?'];
  const resParams: unknown[] = [q.from, q.to];
  if (q.building) {
    podWhere.push('building = ?');
    podParams.push(q.building);
    resWhere.push('p.building = ?');
    resParams.push(q.building);
  }
  if (q.floor !== undefined) {
    podWhere.push('floor = ?');
    podParams.push(q.floor);
    resWhere.push('p.floor = ?');
    resParams.push(q.floor);
  }

  const pods = await all<{ id: number; building: string }>(
    svc.db,
    `SELECT id, building FROM study_pod WHERE ${podWhere.join(' AND ')}`,
    ...podParams,
  );
  const rows = await all<ReservationJoined>(
    svc.db,
    `${RESERVATION_SELECT} WHERE ${resWhere.join(' AND ')} ORDER BY r.start_at`,
    ...resParams,
  );

  const totals = emptyBucket();
  const byBuilding = new Map<string, Bucket & { pods: number }>();
  const daily = new Map<string, Bucket>();
  const hourly = Array.from({ length: 24 }, () => 0);
  const weekdayHour = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  const buildingBucket = (b: string) => {
    if (!byBuilding.has(b)) byBuilding.set(b, { ...emptyBucket(), pods: 0 });
    return byBuilding.get(b)!;
  };
  for (const p of pods) buildingBucket(p.building).pods++;

  for (let i = 0; i < span; i++) {
    const date = addDays(q.from, i);
    const mins = operatingMinutes(operatingHours, date);
    const day = emptyBucket();
    day.capacityMinutes = mins * pods.length;
    daily.set(date, day);
    totals.capacityMinutes += day.capacityMinutes;
    for (const b of byBuilding.values()) b.capacityMinutes += mins * b.pods;
  }

  for (const r of rows) {
    const targets = [totals, buildingBucket(r.pod_building), daily.get(r.date)!].filter(Boolean);
    const used = usedMinutes(r);
    const booked = r.status === 'Cancelled' || r.status === 'NoShow' ? 0 : r.duration_minutes;
    for (const t of targets) {
      t.reservations++;
      if (r.status === 'CheckedIn' || r.status === 'Completed') t.checkedIn++;
      if (r.status === 'NoShow') t.noShows++;
      if (r.status === 'Cancelled') t.cancelled++;
      t.usedMinutes += used;
      t.bookedMinutes += booked;
    }
    // Peak-hour demand: every non-cancelled reservation counts toward each local hour it overlaps.
    if (r.status !== 'Cancelled') {
      const start = epochToLocal(r.start_at, svc.tz);
      const startMin = start.minutes;
      const endMin = startMin + r.duration_minutes;
      for (let h = Math.floor(startMin / 60); h * 60 < endMin && h < 24; h++) {
        hourly[h]++;
        weekdayHour[start.weekday][h]++;
      }
    }
  }

  const peak = hourly.reduce((best, v, h) => (v > hourly[best] ? h : best), 0);
  return {
    range: { from: q.from, to: q.to, days: span },
    filters: { building: q.building ?? null, floor: q.floor ?? null },
    pods: pods.length,
    totals: finish(totals),
    peakHour: hourly[peak] > 0 ? { hour: peak, reservations: hourly[peak] } : null,
    hourly: hourly.map((reservations, hour) => ({ hour, reservations })),
    weekdayHour,
    byBuilding: [...byBuilding.entries()]
      .map(([building, b]) => ({ building, ...finish(b) }))
      .sort((a, b) => a.building.localeCompare(b.building)),
    daily: [...daily.entries()].map(([date, b]) => ({ date, ...finish(b) })),
  };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportReservationsCsv(svc: Services, q: ReportQuery): Promise<string> {
  if (!isValidDate(q.from) || !isValidDate(q.to)) throw badRequest('INVALID_DATE', 'Please choose a valid date range.');
  const where: string[] = ['r.date >= ?', 'r.date <= ?'];
  const params: unknown[] = [q.from, q.to];
  if (q.building) (where.push('p.building = ?'), params.push(q.building));
  if (q.floor !== undefined) (where.push('p.floor = ?'), params.push(q.floor));
  const rows = await all<ReservationJoined>(svc.db, `${RESERVATION_SELECT} WHERE ${where.join(' AND ')} ORDER BY r.start_at`, ...params);
  const header = ['code', 'status', 'source', 'date', 'start_time', 'duration_minutes', 'pod_label', 'building', 'floor', 'student_email', 'checked_in_at', 'check_in_method', 'cancelled_by', 'cancel_reason'];
  const lines = rows.map((r) =>
    [
      r.code,
      r.status,
      r.source,
      r.date,
      r.start_time,
      r.duration_minutes,
      r.pod_label,
      r.pod_building,
      r.pod_floor,
      r.student_email,
      r.checked_in_at ? epochToLocal(r.checked_in_at, svc.tz).date + ' ' + epochToLocal(r.checked_in_at, svc.tz).time : '',
      r.check_in_method,
      r.cancelled_by,
      r.cancel_reason,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n') + '\n';
}
