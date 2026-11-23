/**
 * Database access with plain SQL on PostgreSQL (Neon or any Postgres), using the `pg` driver.
 * Connection string comes from DATABASE_URL in backend/.env.
 *
 * Column names are snake_case in SQL; rows come back with camelCase keys.
 */
import pg from 'pg';
import { env } from '../env';

export type Row = Record<string, any>;

export interface Executor {
  /** Runs a query and returns all rows (camelCase keys). Parameters are $1, $2, ... */
  many<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** First row or undefined. */
  maybe<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** First row; throws if there is none. */
  one<T = Row>(sql: string, params?: unknown[]): Promise<T>;
  /** Runs a statement; returns the number of affected rows. */
  run(sql: string, params?: unknown[]): Promise<number>;
}

const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const mapRow = (r: Row): Row => {
  const out: Row = {};
  for (const k of Object.keys(r)) out[camel(k)] = r[k];
  return out;
};

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<pg.QueryResult> };

function executor(q: Queryable): Executor {
  return {
    async many(sql, params) {
      return (await q.query(sql, params)).rows.map(mapRow) as any[];
    },
    async maybe(sql, params) {
      return (await q.query(sql, params)).rows.map(mapRow)[0] as any;
    },
    async one(sql, params) {
      const row = (await q.query(sql, params)).rows[0];
      if (!row) throw new Error('Expected a row but the query returned none.');
      return mapRow(row) as any;
    },
    async run(sql, params) {
      return (await q.query(sql, params)).rowCount ?? 0;
    },
  };
}

/**
 * Neon/Supabase strings use sslmode=require. Newer pg versions warn that it will mean
 * verify-full; use verify-full explicitly (same behaviour, valid public certificates).
 */
function normaliseSsl(url: string) {
  return url.replace(/([?&])sslmode=(require|prefer|verify-ca)(?=&|$)/, '$1sslmode=verify-full');
}

let pool: pg.Pool | undefined;
function getPool() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Put your PostgreSQL (Neon) connection string in backend/.env.');
  }
  pool ??= new pg.Pool({
    connectionString: normaliseSsl(env.databaseUrl),
    max: 10,
    // Opening a TLS connection to Neon costs ~0.5 s, so keep idle connections for 5 minutes
    // instead of pg's default 10 seconds; otherwise every page after a short pause reconnects.
    idleTimeoutMillis: 5 * 60 * 1000,
    keepAlive: true,
  });
  return pool;
}

const exec: Executor = {
  many: (sql, params) => executor(getPool()).many(sql, params),
  maybe: (sql, params) => executor(getPool()).maybe(sql, params),
  one: (sql, params) => executor(getPool()).one(sql, params),
  run: (sql, params) => executor(getPool()).run(sql, params),
};

export const db = {
  ...exec,
  /** Runs several statements in one transaction. */
  async tx<T>(fn: (e: Executor) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(executor(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  /** Runs a multi-statement SQL script (no parameters). */
  async script(sql: string) {
    await getPool().query(sql);
  },
  async close() {
    await pool?.end();
    pool = undefined;
  },
};
