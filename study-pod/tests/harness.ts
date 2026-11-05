import { createApp } from '../src/worker/app.js';
import type { Env } from '../src/worker/env.js';
import type { EmailMessage, Mailer } from '../src/worker/lib/email.js';
import { localToEpoch } from '../src/worker/lib/time.js';
import { buildServices } from '../src/worker/app.js';
import { runScheduledJobs } from '../src/worker/services/jobs.js';
import { createD1, rawSql } from './d1.js';

export const TZ = 'Asia/Manila';
/** Monday 9 Nov 2026 — the library is open 07:00–21:00 on weekdays by default. */
export const MONDAY = '2026-11-09';
export const at = (date: string, time: string) => localToEpoch(date, time, TZ);

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export function createHarness(envOverrides: Partial<Env> = {}) {
  const db = createD1();
  const sql = rawSql(db);
  sql.exec(`
    INSERT INTO admin_staff (id, full_name, email, role, active, created_at) VALUES
      (1, 'Maria Santos', 'manager@campus.edu', 'facility_manager', 1, 0),
      (2, 'Jose Reyes', 'desk@campus.edu', 'front_desk', 1, 0);
    INSERT INTO study_pod (id, label, name, building, floor, capacity, amenities, status, created_at, updated_at) VALUES
      (1, 'MAIN-2-A1', 'Quiet Pod A1', 'Main Library', 2, 1, '["Power outlet"]', 'active', 0, 0),
      (2, 'MAIN-2-A2', 'Quiet Pod A2', 'Main Library', 2, 1, '[]', 'active', 0, 0),
      (3, 'MAIN-3-G1', 'Group Pod G1', 'Main Library', 3, 4, '["Whiteboard"]', 'active', 0, 0),
      (4, 'MAIN-3-G2', 'Group Pod G2', 'Main Library', 3, 6, '[]', 'maintenance', 0, 0),
      (5, 'ENG-1-S1', 'Engineering Solo 1', 'Engineering Commons', 1, 1, '[]', 'active', 0, 0);
  `);

  const clock = { t: at(MONDAY, '08:00') };
  const emails: EmailMessage[] = [];
  const mailer: Mailer = {
    async send(m) {
      emails.push(m);
      return 'logged';
    },
  };
  const env: Env = {
    DB: db,
    AUTH_MODE: 'dev',
    SESSION_SECRET: 'test-session-secret-0123456789-abcdefghijklmnop',
    CAMPUS_TZ: TZ,
    UNIVERSITY_EMAIL_DOMAIN: 'campus.edu',
    APP_URL: 'https://studypod.test',
    ...envOverrides,
  };
  const app = createApp({ now: () => clock.t, mailer });

  async function call<T = any>(
    method: string,
    path: string,
    opts: { body?: unknown; cookie?: string; noClientHeader?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (!opts.noClientHeader) headers['X-StudyPod-Client'] = 'test';
    const res = await app.request(
      `https://studypod.test${path}`,
      { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) },
      env,
    );
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON (CSV) */
    }
    return { status: res.status, body, headers: res.headers };
  }

  async function login(email: string, name = email.split('@')[0]): Promise<string> {
    const res = await call('POST', '/api/auth/dev-login', { body: { email, name } });
    if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
    const cookie = res.headers.get('set-cookie')!;
    return cookie.split(';')[0];
  }

  async function runCron() {
    const svc = buildServices(env, { now: () => clock.t, mailer }, () => {}, env.APP_URL!);
    const pending: Promise<unknown>[] = [];
    svc.defer = (p) => pending.push(p);
    const result = await runScheduledJobs(svc);
    await Promise.all(pending);
    return result;
  }

  const book = (cookie: string, podId: number, date: string, startTime: string, durationMinutes = 60) =>
    call('POST', '/api/reservations', { cookie, body: { podId, date, startTime, durationMinutes } });

  return { db, sql, env, clock, emails, call, login, runCron, book };
}

export type Harness = ReturnType<typeof createHarness>;
