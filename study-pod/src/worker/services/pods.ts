import { all, first, isUniqueViolation, stmt } from '../lib/db.js';
import { conflict, notFound } from '../lib/errors.js';
import { HOUR } from '../lib/time.js';
import { auditStmt } from './audit.js';
import type { Services } from './context.js';
import { notifyReservation } from './notifications.js';
import { RESERVATION_SELECT, getPodRow, getReservationById, toPod, type Pod, type PodRow, type PodStatus, type ReservationJoined } from './repo.js';
import { bulkStaffCancelStatements } from './reservations.js';
import { getSettings } from './settings.js';

export interface PodInput {
  label: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  amenities: string[];
  notes?: string | null;
}

export async function listPods(db: D1Database, opts: { includeRetired?: boolean } = {}): Promise<Pod[]> {
  const rows = await all<PodRow>(
    db,
    `SELECT * FROM study_pod ${opts.includeRetired ? '' : "WHERE status != 'retired'"} ORDER BY building, floor, label`,
  );
  return rows.map(toPod);
}

export async function getPod(db: D1Database, id: number): Promise<Pod> {
  const row = await getPodRow(db, id);
  if (!row) throw notFound('POD_NOT_FOUND', "We couldn't find that study pod.");
  return toPod(row);
}

/** Buildings and floors that currently have bookable or temporarily unavailable pods. */
export async function listLocations(db: D1Database) {
  const rows = await all<{ building: string; floor: number; pods: number }>(
    db,
    `SELECT building, floor, COUNT(*) AS pods FROM study_pod WHERE status != 'retired'
     GROUP BY building, floor ORDER BY building, floor`,
  );
  const map = new Map<string, number[]>();
  for (const r of rows) {
    if (!map.has(r.building)) map.set(r.building, []);
    map.get(r.building)!.push(r.floor);
  }
  return [...map.entries()].map(([building, floors]) => ({ building, floors }));
}

function duplicateLabel(label: string) {
  return conflict('DUPLICATE_LABEL', `Another pod already uses the label "${label}". Labels must be unique.`);
}

/** SRS 3.2.5 — add a pod. */
export async function createPod(svc: Services, staffId: number, input: PodInput): Promise<Pod> {
  const now = svc.now();
  try {
    const row = await first<PodRow>(
      svc.db,
      `INSERT INTO study_pod (label, name, building, floor, capacity, amenities, status, notes, managed_by_staff_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?) RETURNING *`,
      input.label.trim().toUpperCase(),
      input.name.trim(),
      input.building.trim(),
      input.floor,
      input.capacity,
      JSON.stringify(input.amenities),
      input.notes ?? null,
      staffId,
      now,
      now,
    );
    await svc.db.batch([auditStmt(svc, { type: 'staff', id: staffId }, 'pod.create', 'study_pod', row!.id, input)]);
    return toPod(row!);
  } catch (err) {
    if (isUniqueViolation(err, 'study_pod.label')) throw duplicateLabel(input.label);
    throw err;
  }
}

/** SRS 3.2.5 — edit pod details. Capacity reductions never touch existing bookings. */
export async function updatePod(svc: Services, staffId: number, id: number, input: Partial<PodInput>): Promise<Pod> {
  const current = await getPod(svc.db, id);
  const next = { ...current, ...input };
  try {
    const row = await first<PodRow>(
      svc.db,
      `UPDATE study_pod SET label = ?, name = ?, building = ?, floor = ?, capacity = ?, amenities = ?, notes = ?,
         managed_by_staff_id = ?, updated_at = ?
       WHERE id = ? RETURNING *`,
      next.label.trim().toUpperCase(),
      next.name.trim(),
      next.building.trim(),
      next.floor,
      next.capacity,
      JSON.stringify(next.amenities),
      next.notes ?? null,
      staffId,
      svc.now(),
      id,
    );
    await svc.db.batch([auditStmt(svc, { type: 'staff', id: staffId }, 'pod.update', 'study_pod', id, input)]);
    return toPod(row!);
  } catch (err) {
    if (isUniqueViolation(err, 'study_pod.label')) throw duplicateLabel(next.label);
    throw err;
  }
}

export type CancelMode = 'none' | 'window' | 'all';

/**
 * SRS 3.2.5 — change pod status. Maintenance/retired pods accept no new bookings
 * while existing reservations stay intact unless staff explicitly cancels them.
 * Retiring a pod with reservations inside the conflict window (24 h by default)
 * is rejected unless staff confirms forced cancellation.
 */
export async function changePodStatus(
  svc: Services,
  staffId: number,
  id: number,
  status: PodStatus,
  opts: { cancelReservations?: CancelMode; reason?: string } = {},
) {
  const pod = await getPod(svc.db, id);
  const { policy } = await getSettings(svc.db);
  const now = svc.now();
  const windowEnd = now + policy.retireConflictWindowHours * HOUR;
  const live = await all<ReservationJoined>(
    svc.db,
    `${RESERVATION_SELECT} WHERE r.pod_id = ? AND r.status IN ('Confirmed', 'CheckedIn') AND r.end_at > ? ORDER BY r.start_at`,
    id,
    now,
  );
  const inWindow = live.filter((r) => r.start_at < windowEnd);
  const mode = opts.cancelReservations ?? 'none';

  if (status === 'retired' && inWindow.length > 0 && mode === 'none') {
    throw conflict(
      'RETIRE_CONFLICT',
      `${pod.name} has ${inWindow.length} reservation${inWindow.length === 1 ? '' : 's'} in the next ${policy.retireConflictWindowHours} hours. ` +
        'Confirm that those bookings should be cancelled to retire this pod.',
      {
        affected: inWindow.map((r) => ({
          code: r.code,
          date: r.date,
          startTime: r.start_time,
          status: r.status,
          student: r.student_name,
        })),
      },
    );
  }

  const toCancel = status === 'active' ? [] : mode === 'all' ? live : mode === 'window' ? inWindow : [];
  const reason =
    opts.reason?.trim() ||
    (status === 'retired' ? `${pod.name} has been taken out of service.` : `${pod.name} needs maintenance.`);

  await svc.db.batch([
    stmt(svc.db, `UPDATE study_pod SET status = ?, managed_by_staff_id = ?, updated_at = ? WHERE id = ?`, status, staffId, now, id),
    auditStmt(svc, { type: 'staff', id: staffId }, 'pod.status', 'study_pod', id, { from: pod.status, to: status, cancelled: toCancel.length }),
    ...bulkStaffCancelStatements(
      svc,
      toCancel.map((r) => r.id),
      staffId,
      reason,
    ),
  ]);

  for (const r of toCancel) {
    const fresh = await getReservationById(svc.db, r.id);
    if (fresh?.status === 'Cancelled') svc.defer(notifyReservation(svc, fresh, 'cancelled_by_staff', { reason }));
  }

  return {
    pod: await getPod(svc.db, id),
    cancelledReservations: toCancel.map((r) => r.code),
    remainingReservations: live.length - toCancel.length,
  };
}
