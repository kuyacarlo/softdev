import { beforeEach, describe, expect, it } from 'vitest';
import { MONDAY, at, createHarness, type Harness } from './harness.js';

let h: Harness;
let ana: string;
let ben: string;

beforeEach(async () => {
  h = createHarness();
  ana = await h.login('ana.cruz@campus.edu', 'Ana Cruz');
  ben = await h.login('ben.lim@campus.edu', 'Ben Lim');
});

describe('3.2.4 Check-in and no-show release', () => {
  it('checks in by scanning the pod QR code within the window', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    h.clock.t = at(MONDAY, '10:08');
    const res = await h.call('POST', '/api/checkin', { cookie: ana, body: { podId: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('CheckedIn');
    expect(res.body.reservation.checkInMethod).toBe('qr');
    // Idempotent re-scan
    const again = await h.call('POST', '/api/checkin', { cookie: ana, body: { podId: 1 } });
    expect(again.body.alreadyCheckedIn).toBe(true);
  });

  it('checks in from the confirmation QR / link (reservation code)', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '09:55');
    const res = await h.call('POST', '/api/checkin', { cookie: ana, body: { code } });
    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('CheckedIn');
  });

  it('refuses check-in before the window opens', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    h.clock.t = at(MONDAY, '09:40');
    const res = await h.call('POST', '/api/checkin', { cookie: ana, body: { podId: 1 } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECK_IN_NOT_OPEN');
    expect(res.body.error.message).toMatch(/opens at 09:50/);
  });

  it('tells the student when they scan a pod that is not theirs', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    h.clock.t = at(MONDAY, '10:00');
    const res = await h.call('POST', '/api/checkin', { cookie: ana, body: { podId: 2 } });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Quiet Pod A1/);
  });

  it('AC-02: an unchecked reservation is released after the grace period and reappears in availability', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '10:11');
    const cron = await h.runCron();
    expect(cron.noShows).toBe(1);

    const mine = await h.call('GET', `/api/reservations/${code}`, { cookie: ana });
    expect(mine.body.reservation.status).toBe('NoShow');
    expect(h.emails.some((e) => e.subject.includes('released'))).toBe(true);

    const avail = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:15&durationMinutes=30&floor=2&building=Main%20Library`);
    expect(avail.body.available.map((p: any) => p.id)).toContain(1);
    expect((await h.book(ben, 1, MONDAY, '10:15', 30)).status).toBe(201);
  });

  it('3.2.4.5 late check-in after release explains the expiry and offers rebooking', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    h.clock.t = at(MONDAY, '10:12'); // no cron ran: the lazy sweep must still release it
    const res = await h.call('POST', '/api/checkin', { cookie: ana, body: { podId: 1 } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESERVATION_EXPIRED');
    expect(res.body.error.details.rebook).toMatchObject({ date: MONDAY, startTime: '10:00', podId: 1 });
    // ...and she can immediately rebook
    expect((await h.book(ana, 1, MONDAY, '10:00', 60)).status).toBe(201);
  });

  it('kiosk PIN check-in requires an activated kiosk and hides personal data', async () => {
    const r = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '10:02');
    const anon = await h.call('POST', '/api/kiosk/checkin', { body: { podId: 1, pin: r.checkInCode } });
    expect(anon.status).toBe(401);

    const desk = await h.login('desk@campus.edu');
    const activate = await h.call('POST', '/api/kiosk/session', { cookie: desk, body: { building: 'Main Library' } });
    expect(activate.status).toBe(200);
    const kiosk = activate.headers.get('set-cookie')!.split(';')[0];

    const wrong = await h.call('POST', '/api/kiosk/checkin', { cookie: kiosk, body: { podId: 1, pin: r.checkInCode === '000000' ? '111111' : '000000' } });
    expect(wrong.status).toBe(404);

    const ok = await h.call('POST', '/api/kiosk/checkin', { cookie: kiosk, body: { podId: 1, pin: r.checkInCode } });
    expect(ok.status).toBe(200);
    expect(ok.body.reservation.status).toBe('CheckedIn');
    expect(ok.body.reservation.checkInCode).toBeUndefined();
    expect(ok.body.reservation.student).toEqual({ id: 0, name: 'Ana', email: '' });

    const otherBuilding = await h.call('POST', '/api/kiosk/checkin', { cookie: kiosk, body: { podId: 5, pin: '123456' } });
    expect(otherBuilding.status).toBe(403);
  });

  it('a checked-in student cannot cancel but can end early, freeing the pod', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 120)).body.reservation;
    h.clock.t = at(MONDAY, '10:01');
    await h.call('POST', '/api/checkin', { cookie: ana, body: { code } });
    expect((await h.call('POST', `/api/reservations/${code}/cancel`, { cookie: ana })).body.error.code).toBe('ALREADY_CHECKED_IN');
    h.clock.t = at(MONDAY, '10:50');
    const end = await h.call('POST', `/api/reservations/${code}/end`, { cookie: ana });
    expect(end.body.reservation.status).toBe('Completed');
    expect((await h.book(ben, 1, MONDAY, '11:00', 60)).status).toBe(201);
  });
});

describe('Scheduled jobs (SRS 3.5.2, 3.9)', () => {
  it('sends exactly one reminder 15 minutes before the start', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    h.emails.length = 0;
    h.clock.t = at(MONDAY, '09:44');
    expect((await h.runCron()).reminders).toBe(0);
    h.clock.t = at(MONDAY, '09:45');
    expect((await h.runCron()).reminders).toBe(1);
    h.clock.t = at(MONDAY, '09:46');
    expect((await h.runCron()).reminders).toBe(0);
    expect(h.emails).toHaveLength(1);
    expect(h.emails[0].subject).toMatch(/Reminder/);
  });

  it('marks checked-in reservations Completed after they end, unblocking the next booking', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '10:00');
    await h.call('POST', '/api/checkin', { cookie: ana, body: { code } });
    h.clock.t = at(MONDAY, '11:00');
    expect((await h.runCron()).completed).toBe(1);
    const mine = await h.call('GET', '/api/reservations/mine', { cookie: ana });
    expect(mine.body.active).toBeNull();
    expect(mine.body.history[0].status).toBe('Completed');
  });

  it('releases no-shows within one minute of the grace period elapsing', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    h.clock.t = at(MONDAY, '10:10'); // deadline exactly — still allowed
    expect((await h.runCron()).noShows).toBe(0);
    h.clock.t = at(MONDAY, '10:11');
    expect((await h.runCron()).noShows).toBe(1);
  });
});
