import { beforeEach, describe, expect, it } from 'vitest';
import { MONDAY, at, createHarness, type Harness } from './harness.js';

let h: Harness;
let ana: string;
let ben: string;
let manager: string;
let desk: string;

beforeEach(async () => {
  h = createHarness();
  ana = await h.login('ana.cruz@campus.edu', 'Ana Cruz');
  ben = await h.login('ben.lim@campus.edu', 'Ben Lim');
  manager = await h.login('manager@campus.edu');
  desk = await h.login('desk@campus.edu');
});

describe('Security / RBAC (SRS 3.5.4)', () => {
  it('blocks students and anonymous users from the admin API', async () => {
    expect((await h.call('GET', '/api/admin/reservations')).status).toBe(401);
    expect((await h.call('GET', '/api/admin/reservations', { cookie: ana })).status).toBe(403);
  });

  it('restricts inventory changes, reports and settings to Facility Managers', async () => {
    const pod = { label: 'MAIN-4-X1', name: 'X1', building: 'Main Library', floor: 4, capacity: 1, amenities: [] };
    expect((await h.call('POST', '/api/admin/pods', { cookie: desk, body: pod })).status).toBe(403);
    expect((await h.call('GET', `/api/admin/reports?from=${MONDAY}&to=${MONDAY}`, { cookie: desk })).status).toBe(403);
    expect((await h.call('PUT', '/api/admin/settings', { cookie: desk, body: { policy: { gracePeriodMinutes: 5 } } })).status).toBe(403);
    expect((await h.call('POST', '/api/admin/pods/1/status', { cookie: desk, body: { status: 'retired' } })).status).toBe(403);
    // Front desk may flag maintenance
    expect((await h.call('POST', '/api/admin/pods/1/status', { cookie: desk, body: { status: 'maintenance' } })).status).toBe(200);
  });

  it('revokes access immediately when a staff account is deactivated', async () => {
    const list = await h.call('PATCH', '/api/admin/staff/2', { cookie: manager, body: { active: false } });
    expect(list.status).toBe(200);
    expect((await h.call('GET', '/api/admin/reservations', { cookie: desk })).status).toBe(403);
  });

  it('requires the client header on state-changing requests (CSRF)', async () => {
    const res = await h.call('POST', '/api/reservations', { cookie: ana, noClientHeader: true, body: { podId: 1, date: MONDAY, startTime: '10:00', durationMinutes: 60 } });
    expect(res.status).toBe(403);
  });

  it('only admits university emails and disables mock SSO outside dev mode', async () => {
    const outsider = await h.call('POST', '/api/auth/dev-login', { body: { email: 'someone@gmail.com' } });
    expect(outsider.status).toBe(403);
    const prod = createHarness({ AUTH_MODE: 'oidc' });
    expect((await prod.call('POST', '/api/auth/dev-login', { body: { email: 'ana@campus.edu' } })).status).toBe(403);
    const login = await prod.call('GET', '/api/auth/login');
    expect(login.status).toBe(500);
    expect(login.body.error.code).toBe('SSO_NOT_CONFIGURED');
  });

  it('redirects to the campus IdP with PKCE when SSO is configured', async () => {
    const prod = createHarness({
      AUTH_MODE: 'oidc',
      SSO_AUTHORIZE_URL: 'https://sso.campus.edu/authorize',
      SSO_TOKEN_URL: 'https://sso.campus.edu/token',
      SSO_USERINFO_URL: 'https://sso.campus.edu/userinfo',
      SSO_CLIENT_ID: 'studypod',
    });
    const res = await prod.call('GET', '/api/auth/login?returnTo=/me');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get('location')!);
    expect(url.origin + url.pathname).toBe('https://sso.campus.edu/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe('https://studypod.test/api/auth/callback');
  });
});

describe('3.2.5 Pod inventory management', () => {
  it('AC-03: a new pod is immediately bookable; edits are reflected', async () => {
    const created = await h.call('POST', '/api/admin/pods', {
      cookie: manager,
      body: { label: 'eng-2-g9', name: 'Group 9', building: 'Engineering Commons', floor: 2, capacity: 8, amenities: ['Whiteboard'] },
    });
    expect(created.status).toBe(201);
    expect(created.body.pod.label).toBe('ENG-2-G9');
    const avail = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:00&durationMinutes=60&minCapacity=8`);
    expect(avail.body.available.map((p: any) => p.label)).toEqual(['ENG-2-G9']);

    await h.call('PATCH', `/api/admin/pods/${created.body.pod.id}`, { cookie: manager, body: { capacity: 6 } });
    const after = await h.call('GET', `/api/availability?date=${MONDAY}&startTime=10:00&durationMinutes=60&minCapacity=8`);
    expect(after.body.available).toEqual([]);

    const dup = await h.call('POST', '/api/admin/pods', {
      cookie: manager,
      body: { label: 'ENG-2-G9', name: 'Dup', building: 'Annex', floor: 1, capacity: 1, amenities: [] },
    });
    expect(dup.status).toBe(409);
  });

  it('maintenance blocks new bookings but keeps existing reservations', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    const res = await h.call('POST', '/api/admin/pods/1/status', { cookie: manager, body: { status: 'maintenance' } });
    expect(res.status).toBe(200);
    expect(res.body.remainingReservations).toBe(1);
    expect((await h.book(ben, 1, MONDAY, '14:00', 60)).body.error.code).toBe('POD_UNAVAILABLE');
    expect((await h.call('GET', `/api/reservations/${code}`, { cookie: ana })).body.reservation.status).toBe('Confirmed');
  });

  it('3.2.5.5 retiring a pod with bookings in the next 24 h requires confirmation, then cancels them', async () => {
    const r1 = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    const r2 = (await h.book(ben, 1, '2026-11-12', '10:00', 60)).body.reservation; // 3 days out
    const blocked = await h.call('POST', '/api/admin/pods/1/status', { cookie: manager, body: { status: 'retired' } });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('RETIRE_CONFLICT');
    expect(blocked.body.error.details.affected.map((a: any) => a.code)).toEqual([r1.code]);

    const ok = await h.call('POST', '/api/admin/pods/1/status', {
      cookie: manager,
      body: { status: 'retired', cancelReservations: 'window', reason: 'Water damage' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.cancelledReservations).toEqual([r1.code]);
    expect(ok.body.remainingReservations).toBe(1);
    const a = await h.call('GET', `/api/reservations/${r1.code}`, { cookie: ana });
    expect(a.body.reservation).toMatchObject({ status: 'Cancelled', cancelledBy: 'staff', cancelReason: 'Water damage' });
    expect((await h.call('GET', `/api/reservations/${r2.code}`, { cookie: ben })).body.reservation.status).toBe('Confirmed');
    expect(h.emails.some((e) => e.to === 'ana.cruz@campus.edu' && e.text.includes('Water damage'))).toBe(true);

    const catalog = await h.call('GET', '/api/pods');
    expect(catalog.body.pods.map((p: any) => p.id)).not.toContain(1);
  });
});

describe('3.2.6 Reservation oversight', () => {
  it('lists all reservations with filters and lets staff force-cancel', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    await h.book(ben, 5, MONDAY, '11:00', 60);
    const list = await h.call('GET', `/api/admin/reservations?from=${MONDAY}&to=${MONDAY}&building=Main%20Library`, { cookie: desk });
    expect(list.body.reservations.map((r: any) => r.code)).toEqual([code]);
    expect(list.body.reservations[0].checkInCode).toBeUndefined();

    const search = await h.call('GET', `/api/admin/reservations?q=ben.lim`, { cookie: desk });
    expect(search.body.reservations).toHaveLength(1);

    const cancel = await h.call('POST', `/api/admin/reservations/${code}/cancel`, { cookie: desk, body: { reason: 'Exam proctoring' } });
    expect(cancel.body.reservation).toMatchObject({ status: 'Cancelled', cancelledBy: 'staff' });
    const audit = await h.call('GET', '/api/admin/audit', { cookie: manager });
    expect(audit.body.entries[0].action).toBe('reservation.force_cancel');
  });

  it('creates a walk-in that is checked in immediately, registering new students', async () => {
    h.clock.t = at(MONDAY, '13:07');
    const res = await h.call('POST', '/api/admin/walk-ins', {
      cookie: desk,
      body: { studentEmail: 'carla.diaz@campus.edu', studentName: 'Carla Diaz', podId: 3, durationMinutes: 60 },
    });
    expect(res.status).toBe(201);
    expect(res.body.reservation).toMatchObject({ status: 'CheckedIn', source: 'walk_in', startTime: '13:00', endTime: '14:00' });
    expect((await h.book(ana, 3, MONDAY, '13:30', 30)).body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('staff can check a student in on their behalf', async () => {
    const { code } = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '10:05');
    const res = await h.call('POST', `/api/admin/reservations/${code}/check-in`, { cookie: desk });
    expect(res.body.reservation).toMatchObject({ status: 'CheckedIn', checkInMethod: 'staff' });
  });

  it('records every email in the outbox', async () => {
    await h.book(ana, 1, MONDAY, '10:00', 60);
    const res = await h.call('GET', '/api/admin/notifications', { cookie: desk });
    expect(res.body.notifications[0]).toMatchObject({ kind: 'confirmation', recipient: 'ana.cruz@campus.edu', status: 'logged' });
  });
});

describe('Utilization reporting (SRS 3.2.6)', () => {
  it('computes occupancy, no-show rate and peak hours', async () => {
    const carla = await h.login('carla.diaz@campus.edu', 'Carla Diaz');
    const a = (await h.book(ana, 1, MONDAY, '10:00', 60)).body.reservation;
    await h.book(ben, 2, MONDAY, '10:00', 120); // will be a no-show
    const c = (await h.book(carla, 5, MONDAY, '14:00', 60)).body.reservation;
    h.clock.t = at(MONDAY, '10:05');
    await h.call('POST', '/api/checkin', { cookie: ana, body: { code: a.code } });
    h.clock.t = at(MONDAY, '10:30');
    await h.runCron();
    await h.call('POST', `/api/reservations/${c.code}/cancel`, { cookie: carla });
    h.clock.t = at(MONDAY, '12:00');
    await h.runCron();

    const res = await h.call('GET', `/api/admin/reports?from=${MONDAY}&to=${MONDAY}`, { cookie: manager });
    expect(res.status).toBe(200);
    const t = res.body.totals;
    expect(t).toMatchObject({ reservations: 3, checkedIn: 1, noShows: 1, cancelled: 1, usedMinutes: 60 });
    expect(t.noShowRate).toBeCloseTo(0.5);
    // 5 non-retired pods × 14 open hours on Monday (the maintenance pod still counts as inventory)
    expect(res.body.pods).toBe(5);
    expect(t.capacityMinutes).toBe(5 * 14 * 60);
    expect(t.occupancyRate).toBeCloseTo(60 / (5 * 14 * 60));
    expect(res.body.peakHour).toEqual({ hour: 10, reservations: 2 });
    expect(res.body.byBuilding.map((b: any) => b.building)).toEqual(['Engineering Commons', 'Main Library']);

    const csv = await h.call('GET', `/api/admin/reports/export.csv?from=${MONDAY}&to=${MONDAY}`, { cookie: manager });
    expect(csv.headers.get('content-type')).toMatch(/text\/csv/);
    expect((csv.body as string).trim().split('\n')).toHaveLength(4);
  });
});

describe('Configurable policy (SRS 3.5.5)', () => {
  it('applies new limits without a code change and validates them', async () => {
    const upd = await h.call('PUT', '/api/admin/settings', { cookie: manager, body: { policy: { maxDurationMinutes: 120, maxAdvanceDays: 3 } } });
    expect(upd.status).toBe(200);
    expect((await h.book(ana, 1, MONDAY, '10:00', 180)).body.error.message).toMatch(/between 30 minutes and 2 hours/);
    expect((await h.book(ana, 1, '2026-11-13', '10:00', 60)).body.error.code).toBe('TOO_FAR_IN_ADVANCE');

    const bad = await h.call('PUT', '/api/admin/settings', { cookie: manager, body: { policy: { gracePeriodMinutes: 45 } } });
    expect(bad.status).toBe(400);

    const closed = await h.call('PUT', '/api/admin/settings', {
      cookie: manager,
      body: {
        operatingHours: {
          '0': null,
          '1': { open: '12:00', close: '18:00' },
          '2': { open: '07:00', close: '21:00' },
          '3': { open: '07:00', close: '21:00' },
          '4': { open: '07:00', close: '21:00' },
          '5': { open: '07:00', close: '21:00' },
          '6': null,
        },
      },
    });
    expect(closed.status).toBe(200);
    expect((await h.book(ana, 1, MONDAY, '10:00', 60)).body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
    expect((await h.book(ana, 1, '2026-11-14', '10:00', 60)).body.error.code).toBe('LIBRARY_CLOSED');
    const cfg = await h.call('GET', '/api/config');
    expect(cfg.body.policy.maxDurationMinutes).toBe(120);
  });
});
