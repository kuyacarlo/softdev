import { all, first, run } from '../lib/db.js';
import { describeRange } from '../lib/time.js';
import type { Services } from './context.js';
import type { ReservationJoined } from './repo.js';

export type NotificationKind =
  | 'confirmation'
  | 'modified'
  | 'cancelled'
  | 'cancelled_by_staff'
  | 'reminder'
  | 'no_show'
  | 'walk_in';

/** Record an email in the outbox, then hand it to the mailer and record the outcome. */
export async function sendNotification(
  svc: Services,
  msg: { reservationId: number | null; to: string; kind: NotificationKind; subject: string; text: string },
): Promise<void> {
  const created = await first<{ id: number }>(
    svc.db,
    `INSERT INTO notification (reservation_id, recipient, kind, subject, body, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?) RETURNING id`,
    msg.reservationId,
    msg.to,
    msg.kind,
    msg.subject,
    msg.text,
    svc.now(),
  );
  try {
    const outcome = await svc.mailer.send({ to: msg.to, subject: msg.subject, text: msg.text });
    await run(svc.db, `UPDATE notification SET status = ?, sent_at = ? WHERE id = ?`, outcome, svc.now(), created!.id);
  } catch (err) {
    console.error('[email] delivery failed', err);
    await run(
      svc.db,
      `UPDATE notification SET status = 'failed', error = ? WHERE id = ?`,
      err instanceof Error ? err.message : String(err),
      created!.id,
    );
  }
}

function podLine(r: ReservationJoined): string {
  return `${r.pod_name} (${r.pod_label}) — ${r.pod_building}, Floor ${r.pod_floor}`;
}

/** Compose and send the email for a reservation lifecycle event. */
export async function notifyReservation(
  svc: Services,
  r: ReservationJoined,
  kind: NotificationKind,
  extra: { graceMinutes?: number; reason?: string | null } = {},
): Promise<void> {
  const when = describeRange(r.start_at, r.end_at, svc.tz);
  const myUrl = `${svc.appUrl}/me`;
  const checkInUrl = `${svc.appUrl}/checkin?code=${r.code}`;
  const greeting = `Hi ${r.student_name},`;
  let subject: string;
  let body: string[];

  switch (kind) {
    case 'confirmation':
    case 'modified':
      subject =
        kind === 'confirmation'
          ? `StudyPod reservation confirmed — ${r.pod_label}, ${when}`
          : `StudyPod reservation updated — ${r.pod_label}, ${when}`;
      body = [
        greeting,
        '',
        kind === 'confirmation' ? 'Your study pod is reserved.' : 'Your reservation has been changed.',
        '',
        `Pod:       ${podLine(r)}`,
        `When:      ${when}`,
        `Code:      ${r.code}`,
        `Kiosk PIN: ${r.check_in_code}`,
        '',
        `Check in by scanning the QR code on the pod, from ${checkInUrl}, or by entering your PIN at the kiosk.`,
        `Please check in within ${extra.graceMinutes ?? 10} minutes of your start time — otherwise the pod is released to other students.`,
        '',
        `Your QR check-in code and reservation details: ${myUrl}`,
      ];
      break;
    case 'walk_in':
      subject = `StudyPod walk-in session started — ${r.pod_label}`;
      body = [greeting, '', 'Front desk staff checked you in to a study pod.', '', `Pod:  ${podLine(r)}`, `When: ${when}`, `Code: ${r.code}`];
      break;
    case 'reminder':
      subject = `Reminder: your StudyPod reservation starts at ${r.start_time}`;
      body = [
        greeting,
        '',
        `Your reservation for ${podLine(r)} starts soon (${when}).`,
        `Remember to check in within ${extra.graceMinutes ?? 10} minutes of the start time.`,
        '',
        `Kiosk PIN: ${r.check_in_code}`,
        `Check in: ${checkInUrl}`,
      ];
      break;
    case 'cancelled':
    case 'cancelled_by_staff':
      subject = `StudyPod reservation cancelled — ${r.pod_label}, ${when}`;
      body = [
        greeting,
        '',
        kind === 'cancelled'
          ? `Your reservation ${r.code} for ${podLine(r)} (${when}) has been cancelled.`
          : `Library staff cancelled your reservation ${r.code} for ${podLine(r)} (${when}).`,
        ...(extra.reason ? ['', `Reason: ${extra.reason}`] : []),
        '',
        `You can book another pod at ${svc.appUrl}/`,
      ];
      break;
    case 'no_show':
      subject = `StudyPod reservation released — no check-in for ${r.pod_label}`;
      body = [
        greeting,
        '',
        `We didn't receive a check-in for reservation ${r.code} (${podLine(r)}, ${when}) within the grace period,`,
        'so the pod was released for other students.',
        '',
        `Need a pod? Book again at ${svc.appUrl}/`,
      ];
      break;
  }

  await sendNotification(svc, { reservationId: r.id, to: r.student_email, kind, subject, text: body.join('\n') });
}

export interface NotificationView {
  id: number;
  reservationId: number | null;
  recipient: string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: number;
  sentAt: number | null;
}

export async function listNotifications(db: D1Database, limit = 100): Promise<NotificationView[]> {
  const rows = await all<{
    id: number;
    reservation_id: number | null;
    recipient: string;
    kind: string;
    subject: string;
    body: string;
    status: string;
    error: string | null;
    created_at: number;
    sent_at: number | null;
  }>(db, `SELECT * FROM notification ORDER BY id DESC LIMIT ?`, limit);
  return rows.map((n) => ({
    id: n.id,
    reservationId: n.reservation_id,
    recipient: n.recipient,
    kind: n.kind,
    subject: n.subject,
    body: n.body,
    status: n.status,
    error: n.error,
    createdAt: n.created_at,
    sentAt: n.sent_at,
  }));
}
