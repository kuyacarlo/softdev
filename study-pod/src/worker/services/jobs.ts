import { all, first, placeholders, stmt } from '../lib/db.js';
import { DAY, MINUTE, SLOT_MINUTES } from '../lib/time.js';
import type { Services } from './context.js';
import { notifyReservation } from './notifications.js';
import { RESERVATION_SELECT, type ReservationJoined } from './repo.js';
import { getSettings } from './settings.js';

/** Removes pod_slot rows owned by reservations that no longer hold their pod. */
export const RELEASE_DEAD_SLOTS_SQL = `
  DELETE FROM pod_slot WHERE EXISTS (
    SELECT 1 FROM reservation r
    WHERE r.id = pod_slot.reservation_id AND r.status IN ('Cancelled', 'NoShow')
  )`;

export interface SweepResult {
  noShows: number;
  completed: number;
}

/**
 * Lifecycle sweep (SRS 3.2.4): releases Confirmed reservations whose check-in
 * deadline passed (→ NoShow, pod returned to the pool) and closes CheckedIn
 * reservations whose end time passed (→ Completed).
 *
 * It runs from the per-minute cron trigger (SRS 3.5.2) and also lazily before
 * availability searches, bookings and check-ins, so availability is correct even
 * if a cron invocation is delayed.
 */
export async function sweep(svc: Services): Promise<SweepResult> {
  const now = svc.now();
  const pending = await first<{ one: number }>(
    svc.db,
    `SELECT 1 AS one FROM reservation
     WHERE (status = 'Confirmed' AND check_in_deadline_at < ?) OR (status = 'CheckedIn' AND end_at <= ?)
     LIMIT 1`,
    now,
    now,
  );
  if (!pending) return { noShows: 0, completed: 0 };

  const [expired, , completed] = await svc.db.batch<{ id: number }>([
    stmt(
      svc.db,
      `UPDATE reservation
       SET status = 'NoShow', cancelled_at = ?, cancelled_by = 'system',
           cancel_reason = 'No check-in within the grace period', updated_at = ?
       WHERE status = 'Confirmed' AND check_in_deadline_at < ?
       RETURNING id`,
      now,
      now,
      now,
    ),
    stmt(svc.db, RELEASE_DEAD_SLOTS_SQL),
    stmt(
      svc.db,
      `UPDATE reservation SET status = 'Completed', updated_at = ?
       WHERE status = 'CheckedIn' AND end_at <= ?
       RETURNING id`,
      now,
      now,
    ),
  ]);

  const ids = (expired.results ?? []).map((r) => r.id);
  if (ids.length) {
    const settings = await getSettings(svc.db);
    const rows = await all<ReservationJoined>(
      svc.db,
      `${RESERVATION_SELECT} WHERE r.id IN (${placeholders(ids.length)})`,
      ...ids,
    );
    for (const r of rows) {
      svc.defer(notifyReservation(svc, r, 'no_show', { graceMinutes: settings.policy.gracePeriodMinutes }));
    }
  }
  return { noShows: ids.length, completed: (completed.results ?? []).length };
}

/** SRS 3.9: email a reminder `reminderLeadMinutes` before a reservation starts. */
export async function sendReminders(svc: Services): Promise<number> {
  const now = svc.now();
  const { policy } = await getSettings(svc.db);
  if (policy.reminderLeadMinutes <= 0) return 0;
  const due = await all<ReservationJoined>(
    svc.db,
    `${RESERVATION_SELECT}
     WHERE r.status = 'Confirmed' AND r.reminder_sent_at IS NULL
       AND r.start_at > ? AND r.start_at - ? <= ?`,
    now,
    policy.reminderLeadMinutes * MINUTE,
    now,
  );
  let sent = 0;
  for (const r of due) {
    // Claim the reminder first so overlapping cron runs never double-send.
    const claimed = await first<{ id: number }>(
      svc.db,
      `UPDATE reservation SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL RETURNING id`,
      now,
      r.id,
    );
    if (!claimed) continue;
    svc.defer(notifyReservation(svc, r, 'reminder', { graceMinutes: policy.gracePeriodMinutes }));
    sent++;
  }
  return sent;
}

/** Drop slot rows for time that is long past; reservation history itself is retained (SRS 3.8). */
export async function pruneOldSlots(svc: Services): Promise<void> {
  await svc.db
    .prepare(`DELETE FROM pod_slot WHERE slot_start_at < ?`)
    .bind(svc.now() - DAY - SLOT_MINUTES * MINUTE)
    .run();
}

/** Everything the cron trigger does each minute. */
export async function runScheduledJobs(svc: Services) {
  const result = await sweep(svc);
  const reminders = await sendReminders(svc);
  await pruneOldSlots(svc);
  return { ...result, reminders };
}
