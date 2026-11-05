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

describe('3.2.1 Pod availability browsing', () => {
  it('lists available pods filtered by building, floor and capacity, excluding maintenance', async () => {
    const res = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:00&durationMinutes=60&building=Main%20Library&minCapacity=2`);
    expect(res.status).toBe(200);
    expect(res.body.available.map((p: any) => p.label)).toEqual(['MAIN-3-G1']); // G2 is under maintenance

    const floor2 = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:00&durationMinutes=60&building=Main%20Library&floor=2`);
    expect(floor2.body.available.map((p: any) => p.label)).toEqual(['MAIN-2-A1', 'MAIN-2-A2']);
  });

  it('excludes booked pods and shows busy slots on the timeline', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    const res = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:30&durationMinutes=30&floor=2&building=Main%20Library`);
    expect(res.body.available.map((p: any) => p.id)).toEqual([2]);
    const pod1 = res.body.pods.find((p: any) => p.pod.id === 1);
    expect(pod1.busy).toEqual(['10:00', '10:15', '10:30', '10:45']);
  });

  it('suggests nearest alternative times and locations when nothing matches (3.2.1.5)', async () => {
    await h.book(ana, 5, MONDAY, '10:00', 60);
    const res = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:00&durationMinutes=60&building=Engineering%20Commons`);
    expect(res.body.available).toEqual([]);
    const times = res.body.suggestions.alternativeTimes.map((t: any) => t.startTime);
    expect(times.slice(0, 2)).toEqual(['09:00', '11:00']); // equally near: one hour either side
    expect(res.body.suggestions.alternativeLocations.map((p: any) => p.building)).toContain('Main Library');
  });
});

describe('3.2.2 Reservation creation', () => {
  it('confirms a booking with a reservation code, PIN and confirmation email (AC-01)', async () => {
    const res = await h.book(ana, 1, MONDAY, '10:00', 90);
    expect(res.status).toBe(201);
    const r = res.body.reservation;
    expect(r.status).toBe('Confirmed');
    expect(r.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(r.checkInCode).toMatch(/^\d{6}$/);
    expect(r).toMatchObject({ date: MONDAY, startTime: '10:00', endTime: '11:30', durationMinutes: 90 });
    expect(h.emails).toHaveLength(1);
    expect(h.emails[0].to).toBe('ana.cruz@campus.edu');
    expect(h.emails[0].subject).toContain('confirmed');
    expect(h.emails[0].text).toContain(r.checkInCode);
  });

  it.each([
    [15, 'DURATION_OUT_OF_RANGE'],
    [195, 'DURATION_OUT_OF_RANGE'],
    [50, 'DURATION_OUT_OF_RANGE'],
  ])('rejects a %i-minute booking', async (minutes, code) => {
    const res = await h.book(ana, 1, MONDAY, '10:00', minutes);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.message).toMatch(/between 30 minutes and 3 hours/);
  });

  it('accepts exactly the 30-minute minimum and 3-hour maximum', async () => {
    expect((await h.book(ana, 1, MONDAY, '10:00', 30)).status).toBe(201);
    expect((await h.book(ben, 2, MONDAY, '10:00', 180)).status).toBe(201);
  });

  it('rejects times outside operating hours, misaligned, or in the past', async () => {
    expect((await h.book(ana, 1, MONDAY, '20:30', 60)).body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
    expect((await h.book(ana, 1, MONDAY, '10:10', 60)).body.error.code).toBe('INVALID_TIME');
    expect((await h.book(ana, 1, MONDAY, '07:00', 60)).body.error.code).toBe('TIME_IN_PAST');
  });

  it('allows booking the slot currently in progress (walk-up)', async () => {
    h.clock.t = at(MONDAY, '10:05');
    const res = await h.book(ana, 1, MONDAY, '10:00', 60);
    expect(res.status).toBe(201);
    expect(res.body.reservation.checkInDeadlineAt).toBe(at(MONDAY, '10:15'));
  });

  it('3.6 rejects bookings more than 7 days in advance', async () => {
    expect((await h.book(ana, 1, '2026-11-16', '08:00', 60)).status).toBe(201); // exactly 7 days
    const res = await h.book(ben, 1, '2026-11-16', '09:00', 60);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_FAR_IN_ADVANCE');
  });

  it('rejects bookings against pods under maintenance (3.2.5.3)', async () => {
    const res = await h.book(ana, 4, MONDAY, '10:00', 60);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('POD_UNAVAILABLE');
  });

  it('3.6 a student cannot hold more than one active reservation', async () => {
    expect((await h.book(ana, 1, MONDAY, '10:00', 60)).status).toBe(201);
    const second = await h.book(ana, 2, MONDAY, '14:00', 60);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_RESERVATION_EXISTS');
  });

  it('the database itself enforces one active reservation per student', () => {
    h.sql.exec(`INSERT INTO student (id, full_name, university_email, created_at) VALUES (99, 'X', 'x@campus.edu', 0)`);
    const ins = (code: string) =>
      h.sql.exec(`INSERT INTO reservation (code, check_in_code, student_id, pod_id, date, start_time, duration_minutes,
        start_at, end_at, check_in_deadline_at, status, created_at, updated_at)
        VALUES ('${code}', '1', 99, 1, '${MONDAY}', '10:00', 60, 1, 2, 3, 'Confirmed', 0, 0)`);
    ins('AAAAAA');
    expect(() => ins('BBBBBB')).toThrow(/UNIQUE constraint failed: reservation.student_id/);
  });

  it('rejects a double booking of an overlapping slot with a clear message and current availability (3.2.2.5)', async () => {
    expect((await h.book(ana, 1, MONDAY, '10:00', 60)).status).toBe(201);
    const res = await h.book(ben, 1, MONDAY, '10:30', 60);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(res.body.error.message).toMatch(/no longer available/);
    expect(res.body.error.details.availability.available.map((p: any) => p.id)).toContain(2);
  });

  it('allows back-to-back bookings that touch but do not overlap', async () => {
    expect((await h.book(ana, 1, MONDAY, '10:00', 60)).status).toBe(201);
    expect((await h.book(ben, 1, MONDAY, '11:00', 60)).status).toBe(201);
  });

  it('only one of two simultaneous requests for the same slot wins (optimistic lock)', async () => {
    const results = await Promise.all([h.book(ana, 3, MONDAY, '13:00', 60), h.book(ben, 3, MONDAY, '13:00', 60)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const slots = h.sql.prepare(`SELECT COUNT(*) AS n FROM pod_slot WHERE pod_id = 3`).get() as { n: number };
    expect(slots.n).toBe(4);
  });

  it('requires a signed-in student', async () => {
    const res = await h.call('POST', '/api/reservations', { body: { podId: 1, date: MONDAY, startTime: '10:00', durationMinutes: 60 } });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/sign in/);
  });
});

describe('3.2.3 Modification and cancellation', () => {
  it('moves a reservation to a free slot and frees the old one', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    const res = await h.call('PATCH', `/api/reservations/${code}`, { cookie: ana, body: { date: MONDAY, startTime: '15:00', durationMinutes: 90 } });
    expect(res.status).toBe(200);
    expect(res.body.reservation).toMatchObject({ startTime: '15:00', endTime: '16:30', status: 'Confirmed' });
    expect((await h.book(ben, 1, MONDAY, '10:00', 60)).status).toBe(201);
    expect(h.emails.some((e) => e.subject.includes('updated'))).toBe(true);
  });

  it('rejects modification within 15 minutes of the start time', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '09:46');
    const res = await h.call('PATCH', `/api/reservations/${code}`, { cookie: ana, body: { date: MONDAY, startTime: '12:00', durationMinutes: 60 } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MODIFY_CUTOFF_PASSED');
    expect(res.body.error.message).toMatch(/cancel this reservation and book a new one/);
  });

  it('keeps the original reservation if the new slot is taken', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    await h.book(ben, 1, MONDAY, '12:00', 60);
    const res = await h.call('PATCH', `/api/reservations/${code}`, { cookie: ana, body: { date: MONDAY, startTime: '12:00', durationMinutes: 60 } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    const mine = await h.call('GET', `/api/reservations/${code}`, { cookie: ana });
    expect(mine.body.reservation.startTime).toBe('10:00');
    const slots = h.sql.prepare(`SELECT COUNT(*) AS n FROM pod_slot WHERE pod_id = 1`).get() as { n: number };
    expect(slots.n).toBe(8);
  });

  it('cancels any time before check-in and returns the pod to the pool', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '10:03');
    const res = await h.call('POST', `/api/reservations/${code}/cancel`, { cookie: ana });
    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('Cancelled');
    expect((await h.book(ben, 1, MONDAY, '10:00', 60)).status).toBe(201);
    expect(h.emails.some((e) => e.subject.includes('cancelled'))).toBe(true);
    // Ana may book again now that her reservation is no longer active.
    expect((await h.book(ana, 2, MONDAY, '11:00', 60)).status).toBe(201);
  });

  it("does not let students see or change other students' reservations", async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    expect((await h.call('GET', `/api/reservations/${code}`, { cookie: ben })).status).toBe(404);
    expect((await h.call('POST', `/api/reservations/${code}/cancel`, { cookie: ben })).status).toBe(404);
  });
});
