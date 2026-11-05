import { buildServices, createApp } from './app.js';
import type { Env } from './env.js';
import { runScheduledJobs } from './services/jobs.js';

const app = createApp();

export default {
  fetch: app.fetch,

  /** Cron trigger (every minute): no-show release, completion, reminders (SRS 3.5.2, 3.9). */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const svc = buildServices(env, {}, (p) => ctx.waitUntil(p), env.APP_URL || 'https://studypod.invalid');
    const result = await runScheduledJobs(svc);
    if (result.noShows || result.completed || result.reminders) console.log('[cron]', JSON.stringify(result));
  },
} satisfies ExportedHandler<Env>;
