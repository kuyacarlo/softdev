import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { AdminUser } from '@stella/schema';

// Cloudflare Worker Environment Bindings
export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN?: string;
  PUBLIC_R2_URL?: string;
}

// Custom Hono context variables for authenticated requests
export interface AppVariables {
  user?: AdminUser;
}

// App context type combining bindings and variables
export interface AppContext {
  Bindings: Env;
  Variables: AppVariables;
}
