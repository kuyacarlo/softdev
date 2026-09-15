import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema.js';

// Initialize Drizzle ORM client with full schema and relations
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbClient = ReturnType<typeof getDb>;
