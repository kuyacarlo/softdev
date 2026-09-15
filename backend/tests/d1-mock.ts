import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { D1Database, D1PreparedStatement, D1Response, D1Result } from '@cloudflare/workers-types';

export function createMockD1(): D1Database {
  const sqlite = new Database(':memory:');

  // Load and execute migration SQL
  const migrationPath = join(__dirname, '../drizzle/0000_futuristic_cardiac.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');
  
  // Split statements by statement breakpoint or semicolon
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    sqlite.exec(statement);
  }

  // Implementation of D1 interface over better-sqlite3
  const d1Mock = {
    prepare(query: string) {
      return {
        _query: query,
        _params: [] as any[],
        bind(...params: any[]) {
          this._params = params;
          return this;
        },
        async all<T = any>(): Promise<D1Result<T>> {
          const stmt = sqlite.prepare(this._query);
          const results = stmt.all(...this._params) as T[];
          return {
            results,
            success: true,
            meta: { duration: 0 } as any,
          };
        },
        async run<T = any>(): Promise<D1Response> {
          const stmt = sqlite.prepare(this._query);
          const info = stmt.run(...this._params);
          return {
            success: true,
            meta: {
              duration: 0,
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid),
            } as any,
          };
        },
        async first<T = any>(colName?: string): Promise<T | null> {
          const stmt = sqlite.prepare(this._query);
          const row = stmt.get(...this._params) as any;
          if (!row) return null;
          if (colName) return row[colName] ?? null;
          return row as T;
        },
        async raw<T = any>(): Promise<T[]> {
          const stmt = sqlite.prepare(this._query);
          return stmt.raw(true).all(...this._params) as T[];
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T = any>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },
    async exec(query: string): Promise<D1Response> {
      sqlite.exec(query);
      return {
        success: true,
        meta: { duration: 0 } as any,
      };
    },
  } as unknown as D1Database;

  return d1Mock;
}
