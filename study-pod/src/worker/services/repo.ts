import { first } from '../lib/db.js';
import { MINUTE, epochToLocal } from '../lib/time.js';
import type { Policy } from './settings.js';

export type PodStatus = 'active' | 'maintenance' | 'retired';
export type ReservationStatus = 'Confirmed' | 'CheckedIn' | 'Completed' | 'Cancelled' | 'NoShow';
export const ACTIVE_STATUSES: ReservationStatus[] = ['Confirmed', 'CheckedIn'];

export interface PodRow {
  id: number;
  label: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  amenities: string;
  status: PodStatus;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface Pod {
  id: number;
  label: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  amenities: string[];
  status: PodStatus;
  notes: string | null;
}

export function toPod(row: PodRow): Pod {
  let amenities: string[] = [];
  try {
    amenities = JSON.parse(row.amenities);
  } catch {
    amenities = [];
  }
  return {
    id: row.id,
    label: row.label,
    name: row.name,
    building: row.building,
    floor: row.floor,
    capacity: row.capacity,
    amenities,
    status: row.status,
    notes: row.notes,
  };
}

export async function getPodRow(db: D1Database, id: number): Promise<PodRow | null> {
  return first<PodRow>(db, `SELECT * FROM study_pod WHERE id = ?`, id);
}

export interface ReservationRow {
  id: number;
  code: string;
  check_in_code: string;
  student_id: number;
  pod_id: number;
  date: string;
  start_time: string;
  duration_minutes: number;
  start_at: number;
  end_at: number;
  check_in_deadline_at: number;
  status: ReservationStatus;
  source: 'online' | 'walk_in';
  checked_in_at: number | null;
  check_in_method: string | null;
  ended_early_at: number | null;
  cancelled_at: number | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  reminder_sent_at: number | null;
  created_by_staff_id: number | null;
  created_at: number;
  updated_at: number;
}

/** Reservation joined with its pod and student — the shape most queries return. */
export interface ReservationJoined extends ReservationRow {
  pod_label: string;
  pod_name: string;
  pod_building: string;
  pod_floor: number;
  pod_capacity: number;
  pod_status: PodStatus;
  student_name: string;
  student_email: string;
}

export const RESERVATION_SELECT = `
  SELECT r.*, p.label AS pod_label, p.name AS pod_name, p.building AS pod_building,
         p.floor AS pod_floor, p.capacity AS pod_capacity, p.status AS pod_status,
         s.full_name AS student_name, s.university_email AS student_email
  FROM reservation r
  JOIN study_pod p ON p.id = r.pod_id
  JOIN student s ON s.id = r.student_id`;

export async function getReservationByCode(db: D1Database, code: string): Promise<ReservationJoined | null> {
  return first<ReservationJoined>(db, `${RESERVATION_SELECT} WHERE r.code = ?`, code.toUpperCase());
}

export async function getReservationById(db: D1Database, id: number): Promise<ReservationJoined | null> {
  return first<ReservationJoined>(db, `${RESERVATION_SELECT} WHERE r.id = ?`, id);
}

export interface ReservationView {
  code: string;
  checkInCode?: string;
  status: ReservationStatus;
  source: 'online' | 'walk_in';
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  startAt: number;
  endAt: number;
  checkInOpensAt: number;
  checkInDeadlineAt: number;
  checkedInAt: number | null;
  checkInMethod: string | null;
  endedEarlyAt: number | null;
  cancelledAt: number | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: number;
  pod: { id: number; label: string; name: string; building: string; floor: number; capacity: number };
  student: { id: number; name: string; email: string };
  actions: { canModify: boolean; canCancel: boolean; canCheckIn: boolean; canEndEarly: boolean };
}

export function toReservationView(
  r: ReservationJoined,
  policy: Policy,
  now: number,
  tz: string,
  opts: { includePin: boolean },
): ReservationView {
  const checkInOpensAt = r.start_at - policy.earlyCheckInMinutes * MINUTE;
  return {
    code: r.code,
    ...(opts.includePin ? { checkInCode: r.check_in_code } : {}),
    status: r.status,
    source: r.source,
    date: r.date,
    startTime: r.start_time,
    endTime: epochToLocal(r.end_at, tz).time,
    durationMinutes: r.duration_minutes,
    startAt: r.start_at,
    endAt: r.end_at,
    checkInOpensAt,
    checkInDeadlineAt: r.check_in_deadline_at,
    checkedInAt: r.checked_in_at,
    checkInMethod: r.check_in_method,
    endedEarlyAt: r.ended_early_at,
    cancelledAt: r.cancelled_at,
    cancelledBy: r.cancelled_by,
    cancelReason: r.cancel_reason,
    createdAt: r.created_at,
    pod: {
      id: r.pod_id,
      label: r.pod_label,
      name: r.pod_name,
      building: r.pod_building,
      floor: r.pod_floor,
      capacity: r.pod_capacity,
    },
    student: { id: r.student_id, name: r.student_name, email: r.student_email },
    actions: {
      canModify: r.status === 'Confirmed' && now <= r.start_at - policy.modifyCutoffMinutes * MINUTE,
      canCancel: r.status === 'Confirmed',
      canCheckIn: r.status === 'Confirmed' && now >= checkInOpensAt && now <= r.check_in_deadline_at,
      canEndEarly: r.status === 'CheckedIn' && now < r.end_at,
    },
  };
}
