import { all, first, isUniqueViolation, run } from '../lib/db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import type { SessionUser, StaffRole } from '../env.js';
import type { Services } from './context.js';
import { auditStmt } from './audit.js';

export interface SsoProfile {
  email: string;
  name: string;
  subject?: string | null;
}

interface StaffRow {
  id: number;
  full_name: string;
  email: string;
  role: StaffRole;
  active: number;
  sso_subject: string | null;
  created_at: number;
  last_login_at: number | null;
}

export function allowedDomains(svc: Services): string[] {
  return (svc.env.UNIVERSITY_EMAIL_DOMAIN || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isUniversityEmail(svc: Services, email: string): boolean {
  const domains = allowedDomains(svc);
  const domain = email.toLowerCase().split('@')[1] ?? '';
  return domains.length === 0 || domains.includes(domain);
}

/**
 * Map an identity asserted by campus SSO to a StudyPod user (SRS 3.5.4: no local
 * passwords). Staff are recognised by an active `admin_staff` row; everyone else
 * with a university email is a student.
 */
export async function resolveIdentity(svc: Services, profile: SsoProfile): Promise<SessionUser> {
  const email = profile.email.trim().toLowerCase();
  const name = profile.name.trim() || email.split('@')[0];
  const now = svc.now();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw badRequest('INVALID_EMAIL', 'Your campus account did not provide a valid email address.');

  let staff = await first<StaffRow>(svc.db, `SELECT * FROM admin_staff WHERE email = ?`, email);
  const bootstrap = (svc.env.BOOTSTRAP_MANAGER_EMAIL || '').trim().toLowerCase();
  if (!staff && bootstrap && email === bootstrap) {
    const hasManager = await first(svc.db, `SELECT 1 FROM admin_staff WHERE role = 'facility_manager' AND active = 1`);
    if (!hasManager) {
      staff = await first<StaffRow>(
        svc.db,
        `INSERT INTO admin_staff (full_name, email, role, active, created_at) VALUES (?, ?, 'facility_manager', 1, ?) RETURNING *`,
        name,
        email,
        now,
      );
    }
  }
  if (staff && staff.active) {
    await run(
      svc.db,
      `UPDATE admin_staff SET last_login_at = ?, sso_subject = COALESCE(sso_subject, ?) WHERE id = ?`,
      now,
      profile.subject ?? null,
      staff.id,
    );
    return { kind: 'staff', id: staff.id, email: staff.email, name: staff.full_name, role: staff.role };
  }

  if (!isUniversityEmail(svc, email)) {
    throw forbidden('StudyPod is only available to enrolled students and library staff with a university email address.');
  }
  const student = await upsertStudent(svc, email, name, profile.subject ?? null);
  await run(svc.db, `UPDATE student SET last_login_at = ? WHERE id = ?`, now, student.id);
  return { kind: 'student', id: student.id, email: student.email, name: student.name };
}

export async function upsertStudent(svc: Services, email: string, name: string, subject: string | null) {
  const row = await first<{ id: number; full_name: string; university_email: string }>(
    svc.db,
    `INSERT INTO student (sso_subject, full_name, university_email, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(university_email) DO UPDATE SET
       full_name = excluded.full_name,
       sso_subject = COALESCE(student.sso_subject, excluded.sso_subject)
     RETURNING id, full_name, university_email`,
    subject,
    name,
    email.toLowerCase(),
    svc.now(),
  );
  return { id: row!.id, name: row!.full_name, email: row!.university_email };
}

/** Used by walk-in: find a student by email, registering them if they've never signed in. */
export async function findOrRegisterStudent(svc: Services, email: string, name?: string) {
  const normalized = email.trim().toLowerCase();
  if (!isUniversityEmail(svc, normalized)) {
    throw badRequest('INVALID_EMAIL', `Walk-ins need the student's university email (${allowedDomains(svc).join(', ')}).`);
  }
  const existing = await first<{ id: number; full_name: string; university_email: string }>(
    svc.db,
    `SELECT id, full_name, university_email FROM student WHERE university_email = ?`,
    normalized,
  );
  if (existing) return { id: existing.id, name: existing.full_name, email: existing.university_email };
  if (!name?.trim()) {
    throw badRequest('NAME_REQUIRED', "This student hasn't used StudyPod before — please enter their full name too.");
  }
  return upsertStudent(svc, normalized, name.trim(), null);
}

/** Re-check a staff session against the database so deactivation and role changes apply immediately. */
export async function refreshStaff(db: D1Database, id: number) {
  const s = await first<StaffRow>(db, `SELECT * FROM admin_staff WHERE id = ? AND active = 1`, id);
  return s ? { id: s.id, email: s.email, name: s.full_name, role: s.role } : null;
}

export async function listStaff(db: D1Database) {
  const rows = await all<StaffRow>(db, `SELECT * FROM admin_staff ORDER BY active DESC, role, full_name`);
  return rows.map((s) => ({
    id: s.id,
    name: s.full_name,
    email: s.email,
    role: s.role,
    active: !!s.active,
    lastLoginAt: s.last_login_at,
  }));
}

export async function createStaff(svc: Services, actorId: number, input: { name: string; email: string; role: StaffRole }) {
  try {
    const row = await first<{ id: number }>(
      svc.db,
      `INSERT INTO admin_staff (full_name, email, role, active, created_at) VALUES (?, ?, ?, 1, ?) RETURNING id`,
      input.name.trim(),
      input.email.trim().toLowerCase(),
      input.role,
      svc.now(),
    );
    await svc.db.batch([auditStmt(svc, { type: 'staff', id: actorId }, 'staff.create', 'admin_staff', row!.id, input)]);
  } catch (err) {
    if (isUniqueViolation(err, 'admin_staff.email')) throw conflict('DUPLICATE_STAFF', 'A staff account with that email already exists.');
    throw err;
  }
  return listStaff(svc.db);
}

export async function updateStaff(
  svc: Services,
  actorId: number,
  id: number,
  input: { role?: StaffRole; active?: boolean; name?: string },
) {
  const existing = await first<StaffRow>(svc.db, `SELECT * FROM admin_staff WHERE id = ?`, id);
  if (!existing) throw notFound('STAFF_NOT_FOUND', "We couldn't find that staff account.");
  if (id === actorId && (input.active === false || (input.role && input.role !== existing.role))) {
    throw conflict('SELF_LOCKOUT', "You can't deactivate your own account or change your own role.");
  }
  await run(
    svc.db,
    `UPDATE admin_staff SET role = ?, active = ?, full_name = ? WHERE id = ?`,
    input.role ?? existing.role,
    input.active === undefined ? existing.active : input.active ? 1 : 0,
    input.name?.trim() || existing.full_name,
    id,
  );
  await svc.db.batch([auditStmt(svc, { type: 'staff', id: actorId }, 'staff.update', 'admin_staff', id, input)]);
  return listStaff(svc.db);
}
