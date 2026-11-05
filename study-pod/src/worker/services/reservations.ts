import { all, first, isUniqueViolation, stmt } from '../lib/db.js';
import { checkInPin, reservationCode } from '../lib/codes.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { MINUTE, SLOT_MINUTES, epochToLocal, floorToSlot } from '../lib/time.js';
import { auditStmt } from './audit.js';
import { resolveSlot, searchAvailability, type SlotRequest } from './availability.js';
import type { Actor, Services } from './context.js';
import { sweep } from './jobs.js';
import { notifyReservation } from './notifications.js';
import {
  RESERVATION_SELECT,
  getPodRow,
  getReservationByCode,
  getReservationById,
  toReservationView,
  type PodRow,
  type ReservationJoined,
  type ReservationStatus,
  type ReservationView,
} from './repo.js';
import { getSettings, type Settings } from './settings.js';

const insertSlotsSql = `
  INSERT INTO pod_slot (pod_id, slot_start_at, reservation_id)
  SELECT ?, j.value, r.id FROM reservation r, json_each(?) j WHERE r.code = ?`;

function assertBookable(pod: PodRow | null): asserts pod is PodRow {
  if (!pod) throw notFound('POD_NOT_FOUND', "We couldn't find that study pod.");
  if (pod.status === 'maintenance') {
    throw conflict('POD_UNAVAILABLE', `${pod.name} is under maintenance and can't be booked right now. Please choose another pod.`);
  }
  if (pod.status === 'retired') {
    throw conflict('POD_UNAVAILABLE', `${pod.name} is no longer in service. Please choose another pod.`);
  }
}

async function activeReservationOf(svc: Services, studentId: number): Promise<ReservationJoined | null> {
  return first<ReservationJoined>(
    svc.db,
    `${RESERVATION_SELECT} WHERE r.student_id = ? AND r.status IN ('Confirmed', 'CheckedIn') LIMIT 1`,
    studentId,
  );
}

function activeReservationError(r: ReservationJoined) {
  return conflict(
    'ACTIVE_RESERVATION_EXISTS',
    `You already have an active reservation (${r.code} — ${r.pod_name}, ${r.date} at ${r.start_time}). ` +
      'You can hold only one at a time, so cancel it or wait until it ends before booking another.',
    { reservation: { code: r.code, date: r.date, startTime: r.start_time, pod: r.pod_label } },
  );
}

async function newUniqueCode(svc: Services): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = reservationCode();
    const exists = await first(svc.db, `SELECT 1 FROM reservation WHERE code = ?`, code);
    if (!exists) return code;
  }
  throw new AppError(500, 'CODE_GENERATION_FAILED', 'Please try again in a moment.');
}

async function slotTakenError(svc: Services, req: SlotRequest, pod: PodRow): Promise<AppError> {
  let availability = null;
  try {
    availability = await searchAvailability(svc, {
      date: req.date,
      startTime: req.startTime,
      durationMinutes: req.durationMinutes,
      building: pod.building,
    });
  } catch {
    availability = null;
  }
  return conflict(
    'SLOT_UNAVAILABLE',
    `Sorry — ${pod.name} is no longer available at that time (someone else just booked it). Here is what's still open.`,
    { availability },
  );
}

function view(svc: Services, settings: Settings, r: ReservationJoined, includePin = true): ReservationView {
  return toReservationView(r, settings.policy, svc.now(), svc.tz, { includePin });
}

export interface CreateReservationInput extends SlotRequest {
  podId: number;
}

/** SRS 3.2.2 — create a reservation for a student. */
export async function createReservation(
  svc: Services,
  studentId: number,
  input: CreateReservationInput,
): Promise<ReservationView> {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const now = svc.now();
  const pod = await getPodRow(svc.db, input.podId);
  assertBookable(pod);
  const slot = resolveSlot(settings, svc.tz, now, input);

  const existing = await activeReservationOf(svc, studentId);
  if (existing) throw activeReservationError(existing);

  const code = await newUniqueCode(svc);
  const deadline = Math.max(slot.startAt, now) + settings.policy.gracePeriodMinutes * MINUTE;
  try {
    await svc.db.batch([
      stmt(
        svc.db,
        `INSERT INTO reservation (code, check_in_code, student_id, pod_id, date, start_time, duration_minutes,
           start_at, end_at, check_in_deadline_at, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', 'online', ?, ?)`,
        code,
        checkInPin(),
        studentId,
        pod.id,
        input.date,
        input.startTime,
        input.durationMinutes,
        slot.startAt,
        slot.endAt,
        deadline,
        now,
        now,
      ),
      // Optimistic lock: the pod_slot primary key rejects the whole batch if any slot was taken meanwhile.
      stmt(svc.db, insertSlotsSql, pod.id, JSON.stringify(slot.slotStarts), code),
    ]);
  } catch (err) {
    if (isUniqueViolation(err, 'pod_slot')) throw await slotTakenError(svc, input, pod);
    if (isUniqueViolation(err, 'reservation.student_id')) {
      const again = await activeReservationOf(svc, studentId);
      if (again) throw activeReservationError(again);
    }
    throw err;
  }

  const created = (await getReservationByCode(svc.db, code))!;
  svc.defer(notifyReservation(svc, created, 'confirmation', { graceMinutes: settings.policy.gracePeriodMinutes }));
  return view(svc, settings, created);
}

async function ownReservation(svc: Services, studentId: number, code: string): Promise<ReservationJoined> {
  const r = await getReservationByCode(svc.db, code);
  if (!r || r.student_id !== studentId) throw notFound('RESERVATION_NOT_FOUND', "We couldn't find that reservation.");
  return r;
}

export interface ModifyReservationInput extends SlotRequest {
  podId?: number;
}

/** SRS 3.2.3 — change an upcoming reservation (≥ cutoff minutes before it starts). */
export async function modifyReservation(
  svc: Services,
  studentId: number,
  code: string,
  input: ModifyReservationInput,
): Promise<ReservationView> {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const now = svc.now();
  const r = await ownReservation(svc, studentId, code);
  if (r.status !== 'Confirmed') {
    throw conflict('NOT_MODIFIABLE', "Only upcoming reservations that haven't been checked in can be changed.");
  }
  const cutoff = settings.policy.modifyCutoffMinutes;
  if (now > r.start_at - cutoff * MINUTE) {
    throw conflict(
      'MODIFY_CUTOFF_PASSED',
      `Changes must be made at least ${cutoff} minutes before your reservation starts. ` +
        'To switch to a different time now, cancel this reservation and book a new one.',
    );
  }
  const pod = await getPodRow(svc.db, input.podId ?? r.pod_id);
  assertBookable(pod);
  const slot = resolveSlot(settings, svc.tz, now, input);
  const deadline = Math.max(slot.startAt, now) + settings.policy.gracePeriodMinutes * MINUTE;

  try {
    await svc.db.batch([
      stmt(svc.db, `DELETE FROM pod_slot WHERE reservation_id = ?`, r.id),
      stmt(
        svc.db,
        `UPDATE reservation SET pod_id = ?, date = ?, start_time = ?, duration_minutes = ?, start_at = ?, end_at = ?,
           check_in_deadline_at = ?, reminder_sent_at = NULL, updated_at = ?
         WHERE id = ? AND status = 'Confirmed'`,
        pod.id,
        input.date,
        input.startTime,
        input.durationMinutes,
        slot.startAt,
        slot.endAt,
        deadline,
        now,
        r.id,
      ),
      stmt(svc.db, insertSlotsSql, pod.id, JSON.stringify(slot.slotStarts), r.code),
    ]);
  } catch (err) {
    if (isUniqueViolation(err, 'pod_slot')) throw await slotTakenError(svc, input, pod);
    throw err;
  }
  const updated = (await getReservationById(svc.db, r.id))!;
  svc.defer(notifyReservation(svc, updated, 'modified', { graceMinutes: settings.policy.gracePeriodMinutes }));
  return view(svc, settings, updated);
}

async function cancelInternal(
  svc: Services,
  r: ReservationJoined,
  allowed: ReservationStatus[],
  by: 'student' | 'staff',
  actor: Actor,
  reason: string | null,
): Promise<ReservationJoined> {
  const now = svc.now();
  const statuses = allowed.map((s) => `'${s}'`).join(', ');
  const [res] = await svc.db.batch([
    stmt(
      svc.db,
      `UPDATE reservation SET status = 'Cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?, updated_at = ?
       WHERE id = ? AND status IN (${statuses})`,
      now,
      by,
      reason,
      now,
      r.id,
    ),
    stmt(
      svc.db,
      `DELETE FROM pod_slot WHERE reservation_id = ?
         AND EXISTS (SELECT 1 FROM reservation WHERE id = ? AND status = 'Cancelled')`,
      r.id,
      r.id,
    ),
    ...(actor.type === 'staff' ? [auditStmt(svc, actor, 'reservation.force_cancel', 'reservation', r.code, { reason })] : []),
  ]);
  if (!res.meta.changes) {
    throw conflict('NOT_CANCELLABLE', 'This reservation changed in the meantime and can no longer be cancelled. Please refresh.');
  }
  return (await getReservationById(svc.db, r.id))!;
}

/** SRS 3.2.3 — a student may cancel any time before check-in. */
export async function cancelReservation(svc: Services, studentId: number, code: string): Promise<ReservationView> {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const r = await ownReservation(svc, studentId, code);
  if (r.status === 'CheckedIn') {
    throw conflict('ALREADY_CHECKED_IN', 'You have already checked in. Use "End session early" to free the pod instead.');
  }
  if (r.status !== 'Confirmed') {
    throw conflict('NOT_CANCELLABLE', `This reservation is already ${statusWord(r.status)} and can't be cancelled.`);
  }
  const cancelled = await cancelInternal(svc, r, ['Confirmed'], 'student', { type: 'student', id: studentId }, null);
  svc.defer(notifyReservation(svc, cancelled, 'cancelled'));
  return view(svc, settings, cancelled);
}

/** SRS 3.2.6 — staff force-cancel of any live reservation. */
export async function staffCancelReservation(
  svc: Services,
  staffId: number,
  code: string,
  reason: string | null,
): Promise<ReservationView> {
  const settings = await getSettings(svc.db);
  const r = await getReservationByCode(svc.db, code);
  if (!r) throw notFound('RESERVATION_NOT_FOUND', "We couldn't find that reservation.");
  if (r.status !== 'Confirmed' && r.status !== 'CheckedIn') {
    throw conflict('NOT_CANCELLABLE', `This reservation is already ${statusWord(r.status)}.`);
  }
  const cancelled = await cancelInternal(svc, r, ['Confirmed', 'CheckedIn'], 'staff', { type: 'staff', id: staffId }, reason);
  svc.defer(notifyReservation(svc, cancelled, 'cancelled_by_staff', { reason }));
  return view(svc, settings, cancelled);
}

/** Statements that cancel every live reservation in `ids` (used when retiring a pod). */
export function bulkStaffCancelStatements(svc: Services, ids: number[], staffId: number, reason: string): D1PreparedStatement[] {
  const now = svc.now();
  return ids.flatMap((id) => [
    stmt(
      svc.db,
      `UPDATE reservation SET status = 'Cancelled', cancelled_at = ?, cancelled_by = 'staff', cancel_reason = ?, updated_at = ?
       WHERE id = ? AND status IN ('Confirmed', 'CheckedIn')`,
      now,
      reason,
      now,
      id,
    ),
    stmt(svc.db, `DELETE FROM pod_slot WHERE reservation_id = ?`, id),
    auditStmt(svc, { type: 'staff', id: staffId }, 'reservation.force_cancel', 'reservation', id, { reason }),
  ]);
}

function statusWord(s: ReservationStatus): string {
  return { Confirmed: 'confirmed', CheckedIn: 'checked in', Completed: 'completed', Cancelled: 'cancelled', NoShow: 'released as a no-show' }[s];
}

type CheckInMethod = 'qr' | 'kiosk' | 'staff';

async function applyCheckIn(
  svc: Services,
  settings: Settings,
  r: ReservationJoined,
  method: CheckInMethod,
): Promise<{ reservation: ReservationView; alreadyCheckedIn: boolean }> {
  const now = svc.now();
  if (r.status === 'CheckedIn') return { reservation: view(svc, settings, r), alreadyCheckedIn: true };
  if (r.status === 'NoShow') throw await expiredError(svc, r);
  if (r.status !== 'Confirmed') {
    throw conflict('NOT_CHECKABLE', `This reservation is ${statusWord(r.status)}, so there is nothing to check in to.`);
  }
  const opensAt = r.start_at - settings.policy.earlyCheckInMinutes * MINUTE;
  if (now < opensAt) {
    throw conflict(
      'CHECK_IN_NOT_OPEN',
      `Check-in for this reservation opens at ${epochToLocal(opensAt, svc.tz).time} on ${r.date}. Please come back then.`,
      { opensAt },
    );
  }
  if (now > r.check_in_deadline_at) {
    await sweep(svc);
    throw await expiredError(svc, r);
  }
  const res = await svc.db
    .prepare(
      `UPDATE reservation SET status = 'CheckedIn', checked_in_at = ?, check_in_method = ?, updated_at = ?
       WHERE id = ? AND status = 'Confirmed'`,
    )
    .bind(now, method, now, r.id)
    .run();
  if (!res.meta.changes) {
    const fresh = (await getReservationById(svc.db, r.id))!;
    if (fresh.status === 'CheckedIn') return { reservation: view(svc, settings, fresh), alreadyCheckedIn: true };
    throw await expiredError(svc, fresh);
  }
  const updated = (await getReservationById(svc.db, r.id))!;
  return { reservation: view(svc, settings, updated), alreadyCheckedIn: false };
}

/** SRS 3.2.4.5 — check-in after auto-release: explain and offer rebooking. */
async function expiredError(svc: Services, r: ReservationJoined): Promise<AppError> {
  const now = svc.now();
  const today = epochToLocal(now, svc.tz).date;
  return conflict(
    'RESERVATION_EXPIRED',
    `Your reservation ${r.code} expired because no one checked in within the grace period, so ${r.pod_name} was released. ` +
      'You can book it again below if it is still free.',
    { rebook: { date: today, startTime: epochToLocal(floorToSlot(now, svc.tz), svc.tz).time, podId: r.pod_id, building: r.pod_building } },
  );
}

/**
 * SRS 3.2.4 — student check-in, either by scanning the QR code on the pod
 * (`podId`) or by opening the QR/link from their confirmation (`code`).
 */
export async function studentCheckIn(
  svc: Services,
  studentId: number,
  input: { code?: string; podId?: number },
) {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  let r: ReservationJoined | null = null;
  if (input.code) {
    r = await ownReservation(svc, studentId, input.code);
    if (input.podId && r.pod_id !== input.podId) {
      throw conflict('WRONG_POD', `This reservation is for ${r.pod_name} (${r.pod_label}). Please check in at that pod.`);
    }
  } else if (input.podId) {
    r =
      (await first<ReservationJoined>(
        svc.db,
        `${RESERVATION_SELECT} WHERE r.student_id = ? AND r.pod_id = ? AND r.status IN ('Confirmed', 'CheckedIn')
         ORDER BY r.start_at LIMIT 1`,
        studentId,
        input.podId,
      )) ??
      (await first<ReservationJoined>(
        svc.db,
        `${RESERVATION_SELECT} WHERE r.student_id = ? AND r.pod_id = ? AND r.status = 'NoShow' AND r.cancelled_at > ?
         ORDER BY r.start_at DESC LIMIT 1`,
        studentId,
        input.podId,
        svc.now() - 3 * 60 * MINUTE,
      ));
    if (!r) {
      const active = await activeReservationOf(svc, studentId);
      throw notFound(
        'NO_RESERVATION_FOR_POD',
        active
          ? `Your reservation is for ${active.pod_name} (${active.pod_label}), not this pod.`
          : "You don't have a reservation for this pod right now. You can book it if it's free.",
      );
    }
  } else {
    throw badRequest('MISSING_INPUT', 'Scan the QR code on your pod or enter your reservation code.');
  }
  return applyCheckIn(svc, settings, r, 'qr');
}

/** Kiosk PIN check-in at a shared tablet near the pod cluster (SRS 3.1.2). */
export async function kioskCheckIn(svc: Services, input: { podId: number; pin: string }, building: string | null) {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const pod = await getPodRow(svc.db, input.podId);
  if (!pod) throw notFound('POD_NOT_FOUND', "We couldn't find that study pod.");
  if (building && pod.building !== building) throw forbidden('This kiosk can only check in pods in its own building.');
  const r =
    (await first<ReservationJoined>(
      svc.db,
      `${RESERVATION_SELECT} WHERE r.pod_id = ? AND r.check_in_code = ? AND r.status IN ('Confirmed', 'CheckedIn')
       ORDER BY r.start_at LIMIT 1`,
      pod.id,
      input.pin,
    )) ??
    (await first<ReservationJoined>(
      svc.db,
      `${RESERVATION_SELECT} WHERE r.pod_id = ? AND r.check_in_code = ? AND r.status = 'NoShow' AND r.cancelled_at > ?
       ORDER BY r.start_at DESC LIMIT 1`,
      pod.id,
      input.pin,
      svc.now() - 3 * 60 * MINUTE,
    ));
  if (!r) throw notFound('PIN_NOT_FOUND', "That PIN doesn't match a reservation for this pod. Please check it and try again.");
  const result = await applyCheckIn(svc, settings, r, 'kiosk');
  // A shared kiosk must not reveal the PIN or the student's email.
  const { checkInCode: _pin, ...safe } = result.reservation;
  void _pin;
  return { ...result, reservation: { ...safe, student: { id: 0, name: firstName(safe.student.name), email: '' } } };
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? '';
}

export async function staffCheckIn(svc: Services, staffId: number, code: string) {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const r = await getReservationByCode(svc.db, code);
  if (!r) throw notFound('RESERVATION_NOT_FOUND', "We couldn't find that reservation.");
  const result = await applyCheckIn(svc, settings, r, 'staff');
  await svc.db.batch([auditStmt(svc, { type: 'staff', id: staffId }, 'reservation.staff_check_in', 'reservation', r.code)]);
  return result;
}

/** A checked-in student leaving early frees the rest of the slot for others. */
export async function endSessionEarly(svc: Services, studentId: number, code: string): Promise<ReservationView> {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const r = await ownReservation(svc, studentId, code);
  if (r.status !== 'CheckedIn') throw conflict('NOT_IN_SESSION', 'You can only end a session you are checked in to.');
  const now = svc.now();
  await svc.db.batch([
    stmt(
      svc.db,
      `UPDATE reservation SET status = 'Completed', ended_early_at = ?, updated_at = ? WHERE id = ? AND status = 'CheckedIn'`,
      now,
      now,
      r.id,
    ),
    stmt(svc.db, `DELETE FROM pod_slot WHERE reservation_id = ? AND slot_start_at + ? > ?`, r.id, SLOT_MINUTES * MINUTE, now),
  ]);
  return view(svc, settings, (await getReservationById(svc.db, r.id))!);
}

/** SRS 3.2.6 — front-desk walk-in: book the current slot for a student and check them in immediately. */
export async function createWalkIn(
  svc: Services,
  staffId: number,
  input: { studentId: number; podId: number; durationMinutes: number },
): Promise<ReservationView> {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const now = svc.now();
  const pod = await getPodRow(svc.db, input.podId);
  assertBookable(pod);
  const startAt = floorToSlot(now, svc.tz);
  const local = epochToLocal(startAt, svc.tz);
  const req = { date: local.date, startTime: local.time, durationMinutes: input.durationMinutes };
  const slot = resolveSlot(settings, svc.tz, now, req, { enforceAdvanceLimit: false });
  const existing = await activeReservationOf(svc, input.studentId);
  if (existing) throw activeReservationError(existing);
  const code = await newUniqueCode(svc);
  try {
    await svc.db.batch([
      stmt(
        svc.db,
        `INSERT INTO reservation (code, check_in_code, student_id, pod_id, date, start_time, duration_minutes,
           start_at, end_at, check_in_deadline_at, status, source, checked_in_at, check_in_method,
           created_by_staff_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CheckedIn', 'walk_in', ?, 'walk_in', ?, ?, ?)`,
        code,
        checkInPin(),
        input.studentId,
        pod.id,
        req.date,
        req.startTime,
        req.durationMinutes,
        slot.startAt,
        slot.endAt,
        slot.startAt + settings.policy.gracePeriodMinutes * MINUTE,
        now,
        staffId,
        now,
        now,
      ),
      stmt(svc.db, insertSlotsSql, pod.id, JSON.stringify(slot.slotStarts), code),
      auditStmt(svc, { type: 'staff', id: staffId }, 'reservation.walk_in', 'reservation', code, { podId: pod.id }),
    ]);
  } catch (err) {
    if (isUniqueViolation(err, 'pod_slot')) {
      throw conflict('SLOT_UNAVAILABLE', `${pod.name} is booked for part of that time. Choose a shorter duration or another pod.`);
    }
    if (isUniqueViolation(err, 'reservation.student_id')) {
      const again = await activeReservationOf(svc, input.studentId);
      if (again) throw activeReservationError(again);
    }
    throw err;
  }
  const created = (await getReservationByCode(svc.db, code))!;
  svc.defer(notifyReservation(svc, created, 'walk_in'));
  return view(svc, settings, created);
}

export async function listStudentReservations(svc: Services, studentId: number) {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const rows = await all<ReservationJoined>(
    svc.db,
    `${RESERVATION_SELECT} WHERE r.student_id = ? ORDER BY r.start_at DESC LIMIT 100`,
    studentId,
  );
  const views = rows.map((r) => view(svc, settings, r));
  return {
    active: views.find((v) => v.status === 'Confirmed' || v.status === 'CheckedIn') ?? null,
    history: views.filter((v) => v.status !== 'Confirmed' && v.status !== 'CheckedIn'),
  };
}

export async function getStudentReservation(svc: Services, studentId: number, code: string) {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  return view(svc, settings, await ownReservation(svc, studentId, code));
}

export interface AdminReservationFilter {
  from?: string;
  to?: string;
  building?: string;
  floor?: number;
  status?: ReservationStatus;
  q?: string;
  limit?: number;
}

/** SRS 3.2.6 — staff view of all reservations. */
export async function listAdminReservations(svc: Services, f: AdminReservationFilter) {
  await sweep(svc);
  const settings = await getSettings(svc.db);
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.from) (where.push('r.date >= ?'), params.push(f.from));
  if (f.to) (where.push('r.date <= ?'), params.push(f.to));
  if (f.building) (where.push('p.building = ?'), params.push(f.building));
  if (f.floor !== undefined) (where.push('p.floor = ?'), params.push(f.floor));
  if (f.status) (where.push('r.status = ?'), params.push(f.status));
  if (f.q) {
    where.push('(r.code = ? OR s.university_email LIKE ? OR s.full_name LIKE ? OR p.label LIKE ?)');
    const like = `%${f.q}%`;
    params.push(f.q.toUpperCase(), like, like, like);
  }
  const rows = await all<ReservationJoined>(
    svc.db,
    `${RESERVATION_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY r.start_at DESC LIMIT ?`,
    ...params,
    Math.min(f.limit ?? 200, 1000),
  );
  return rows.map((r) => view(svc, settings, r, false));
}
