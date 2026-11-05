import type { Env } from '../env.js';
import type { Mailer } from '../lib/email.js';

/** Everything a service needs: DB, config, a clock (injectable for tests) and a mailer. */
export interface Services {
  db: D1Database;
  env: Env;
  tz: string;
  now: () => number;
  mailer: Mailer;
  /** Base URL used for links in emails. */
  appUrl: string;
  /** Run background work (ctx.waitUntil on Workers; awaited in tests). */
  defer: (work: Promise<unknown>) => void;
}

export type Actor =
  | { type: 'student'; id: number }
  | { type: 'staff'; id: number }
  | { type: 'system'; id: null };
