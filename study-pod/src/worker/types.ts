import type { Env, SessionUser } from './env.js';
import type { KioskSession } from './lib/session.js';
import type { Services } from './services/context.js';

export type AppEnv = {
  Bindings: Env;
  Variables: {
    svc: Services;
    user: SessionUser | null;
    kiosk: KioskSession | null;
  };
};
