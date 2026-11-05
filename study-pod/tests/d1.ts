/**
 * Minimal Cloudflare D1 implementation on Node's built-in SQLite, faithful to the
 * parts StudyPod relies on: prepared statements, RETURNING, and transactional
 * `batch()` (all statements commit or none do).
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type Sqlite = InstanceType<typeof DatabaseSync>;
type Value = null | number | bigint | string | Uint8Array;

function normalize(params: unknown[]): Value[] {
  return params.map((p) => {
    if (p === undefined) throw new Error('D1_TYPE_ERROR: Type undefined is not supported');
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as Value;
  });
}

const returnsRows = (sql: string) => /^\s*(SELECT|WITH|PRAGMA)/i.test(sql) || /\bRETURNING\b/i.test(sql);

class Statement {
  params: Value[] = [];
  constructor(
    private readonly db: Sqlite,
    readonly sql: string,
  ) {}
  bind(...params: unknown[]) {
    const s = new Statement(this.db, this.sql);
    s.params = normalize(params);
    return s;
  }
  execute() {
    const st = this.db.prepare(this.sql);
    if (returnsRows(this.sql)) {
      const results = st.all(...this.params) as Record<string, unknown>[];
      const changes = Number((this.db.prepare('SELECT changes() AS c').get() as { c: number }).c);
      return { results, success: true, meta: { changes: /^\s*SELECT/i.test(this.sql) ? 0 : changes, last_row_id: 0, duration: 0 } };
    }
    const info = st.run(...this.params);
    return {
      results: [],
      success: true,
      meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid), duration: 0 },
    };
  }
  async all() {
    return this.execute();
  }
  async run() {
    return this.execute();
  }
  async first(col?: string) {
    const { results } = this.execute();
    const row = results[0];
    if (!row) return null;
    return col ? (row[col] ?? null) : row;
  }
  async raw() {
    return this.execute().results.map((r) => Object.values(r));
  }
}

export function createD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(join(dir, f), 'utf8'));
  }
  const d1 = {
    prepare: (sql: string) => new Statement(sqlite, sql),
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN');
      try {
        const out = statements.map((s) => s.execute());
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    _sqlite: sqlite,
  };
  return d1 as unknown as D1Database;
}

export function rawSql(db: D1Database): Sqlite {
  return (db as unknown as { _sqlite: Sqlite })._sqlite;
}
