import { AsyncLocalStorage } from "node:async_hooks"
import fs from "node:fs"
import path from "node:path"
import type { SQLInputValue, StatementSync } from "node:sqlite"
import type { Pool, PoolClient, QueryResultRow } from "pg"

export type SqlResult = { changes: number }

export type SqlStatement = {
  get: <T = unknown>(...params: unknown[]) => Promise<T | undefined>
  all: <T = unknown>(...params: unknown[]) => Promise<T[]>
  run: (...params: unknown[]) => Promise<SqlResult>
}

export type SqlDb = {
  prepare: (sql: string) => SqlStatement
  exec: (sql: string) => Promise<void>
  transaction: <T>(fn: () => Promise<T>) => () => Promise<T>
  backup?: (dest: string) => Promise<void>
  close: () => Promise<void>
}

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
      profile_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS access_log (
      id TEXT PRIMARY KEY,
      staff_email TEXT NOT NULL,
      member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opened_at TEXT NOT NULL
    );
    DROP TABLE IF EXISTS mollie_payments;
    DROP TABLE IF EXISTS mollie_subscriptions;
    DROP TABLE IF EXISTS mollie_customers;
    DROP TABLE IF EXISTS plan_events;
    CREATE TABLE IF NOT EXISTS pair_invites (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offset_minutes INTEGER,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      pair_id TEXT
    );
    CREATE TABLE IF NOT EXISTS pairs (
      id TEXT PRIMARY KEY,
      user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_on TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ended_at TEXT,
      ended_streak INTEGER,
      ended_longest INTEGER,
      share_a INTEGER NOT NULL DEFAULT 0,
      share_b INTEGER NOT NULL DEFAULT 0,
      offset_a INTEGER,
      offset_b INTEGER,
      nudge_date TEXT,
      nudge_by TEXT
    );
    CREATE INDEX IF NOT EXISTS pairs_user_a ON pairs(user_a);
    CREATE INDEX IF NOT EXISTS pairs_user_b ON pairs(user_b);
    CREATE TABLE IF NOT EXISTS pair_pauses (
      pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      week_monday TEXT NOT NULL,
      on_date TEXT NOT NULL,
      spent_by TEXT NOT NULL CHECK (spent_by IN ('a', 'b')),
      PRIMARY KEY (pair_id, week_monday)
    );
    CREATE TABLE IF NOT EXISTS buddy_codes (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pair_requests (
      id TEXT PRIMARY KEY,
      from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS score_nudges (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sent_on TEXT NOT NULL,
      message TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (pair_id, from_user, sent_on)
    );
    CREATE INDEX IF NOT EXISTS pair_requests_to ON pair_requests(to_user, status);
    CREATE UNIQUE INDEX IF NOT EXISTS pair_requests_one_pending ON pair_requests(from_user, to_user) WHERE status = 'pending';
    CREATE TABLE IF NOT EXISTS pair_repairs (
      pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      gap_date TEXT NOT NULL,
      agreed_a INTEGER NOT NULL DEFAULT 0,
      agreed_b INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (pair_id, month)
    );
    CREATE TABLE IF NOT EXISTS recovery_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('reset')),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS recovery_user ON recovery_tokens(user_id, created_at);
    CREATE TABLE IF NOT EXISTS mail_outbox (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      used_at TEXT,
      used_user_id TEXT REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS rate_hits (
      id TEXT PRIMARY KEY,
      bucket TEXT NOT NULL,
      hit_key TEXT NOT NULL,
      hit_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rate_hits_lookup ON rate_hits(bucket, hit_key, hit_at);
`

const txClient = new AsyncLocalStorage<PoolClient>()
const globalForSql = globalThis as unknown as {
  epochSql?: SqlDb
  epochSqlReady?: Promise<SqlDb>
  epochSqlite?: { close: () => void }
  epochPgPool?: Pool
  epochSeeder?: (db: SqlDb) => Promise<void>
}

export function usesPostgres() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function usesFileDatabase() {
  return !usesPostgres()
}

export function databasePath() {
  return databaseFile()
}

function databaseFile() {
  const configured = process.env.EPOCH_DB?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === "production" && !usesPostgres()) {
    throw new Error("Set EPOCH_DB to a SQLite file on a persistent volume. Run one server process against that file.")
  }
  return path.join(process.cwd(), "data", "epoch.sqlite")
}

export function setSeeder(fn: (db: SqlDb) => Promise<void>) {
  globalForSql.epochSeeder = fn
}

export function resetDbForTests() {
  globalForSql.epochSqlReady = undefined
  globalForSql.epochSql = undefined
  if (globalForSql.epochSqlite) {
    try {
      globalForSql.epochSqlite.close()
    } catch {
      // The test file may already be gone.
    }
    globalForSql.epochSqlite = undefined
  }
}

export async function getDb(): Promise<SqlDb> {
  if (!globalForSql.epochSqlReady) {
    globalForSql.epochSqlReady = openEngine()
  }
  return globalForSql.epochSqlReady
}

export async function qget<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  return (await getDb()).prepare(sql).get<T>(...params)
}

export async function qall<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  return (await getDb()).prepare(sql).all<T>(...params)
}

export async function qrun(sql: string, ...params: unknown[]): Promise<SqlResult> {
  return (await getDb()).prepare(sql).run(...params)
}

export async function qtx<T>(fn: () => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn)()
}

async function openEngine(): Promise<SqlDb> {
  const db = usesPostgres() ? await openPostgres() : await openSqlite()
  await db.exec(SCHEMA)
  if (globalForSql.epochSeeder) await globalForSql.epochSeeder(db)
  globalForSql.epochSql = db
  if (usesFileDatabase()) {
    void import("./backup").then((mod) => mod.startBackupLoop())
  }
  return db
}

function isNamed(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
}

function applySqlite(stmt: StatementSync, method: "get" | "all" | "run", params: unknown[]) {
  if (params.length === 1 && isNamed(params[0])) {
    return stmt[method](params[0] as Record<string, SQLInputValue>)
  }
  return stmt[method](...(params as SQLInputValue[]))
}

async function openSqlite(): Promise<SqlDb> {
  const { DatabaseSync } = await import("node:sqlite")
  const file = databaseFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const sqlite = new DatabaseSync(file)
  sqlite.exec("PRAGMA journal_mode = WAL")
  sqlite.exec("PRAGMA foreign_keys = ON")
  sqlite.exec("PRAGMA busy_timeout = 5000")
  globalForSql.epochSqlite = sqlite
  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql)
      return {
        async get<T>(...params: unknown[]) {
          const row = applySqlite(stmt, "get", params)
          return (row ?? undefined) as T | undefined
        },
        async all<T>(...params: unknown[]) {
          return applySqlite(stmt, "all", params) as T[]
        },
        async run(...params: unknown[]) {
          const result = applySqlite(stmt, "run", params) as { changes?: number }
          return { changes: Number(result.changes ?? 0) }
        },
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql)
    },
    transaction<T>(fn: () => Promise<T>) {
      return async () => {
        sqlite.exec("BEGIN IMMEDIATE")
        try {
          const result = await fn()
          sqlite.exec("COMMIT")
          return result
        } catch (error) {
          sqlite.exec("ROLLBACK")
          throw error
        }
      }
    },
    async backup(dest: string) {
      const escaped = dest.replaceAll("'", "''")
      sqlite.exec(`VACUUM INTO '${escaped}'`)
    },
    async close() {
      sqlite.close()
      globalForSql.epochSqlite = undefined
    },
  }
}

async function openPostgres(): Promise<SqlDb> {
  const { Pool } = await import("pg")
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error("The database could not be opened.")
  const pool = globalForSql.epochPgPool ?? new Pool({ connectionString: url, max: 1 })
  globalForSql.epochPgPool = pool
  const query = async <T extends QueryResultRow>(sql: string, params: unknown[] = []) => {
    const client = txClient.getStore()
    const { text, values } = toPg(sql, params)
    return client ? client.query<T>(text, values) : pool.query<T>(text, values)
  }
  return {
    prepare(sql: string) {
      return {
        async get<T>(...params: unknown[]) {
          const result = await query<QueryResultRow>(sql, params)
          return normalizeRow(result.rows[0]) as T | undefined
        },
        async all<T>(...params: unknown[]) {
          const result = await query<QueryResultRow>(sql, params)
          return result.rows.map((row) => normalizeRow(row) as T)
        },
        async run(...params: unknown[]) {
          const result = await query(sql, params)
          return { changes: result.rowCount ?? 0 }
        },
      }
    },
    async exec(sql: string) {
      await pool.query(sql)
    },
    transaction<T>(fn: () => Promise<T>) {
      return async () => {
        const client = await pool.connect()
        try {
          await client.query("BEGIN")
          const result = await txClient.run(client, fn)
          await client.query("COMMIT")
          return result
        } catch (error) {
          try {
            await client.query("ROLLBACK")
          } catch {
            // The connection may already be closed.
          }
          throw error
        } finally {
          client.release()
        }
      }
    },
    async close() {
      await pool.end()
      globalForSql.epochPgPool = undefined
    },
  }
}

function toPg(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  if (params.length === 1 && isNamed(params[0])) {
    const obj = params[0]
    const values: unknown[] = []
    const text = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
      values.push(obj[name])
      return `$${values.length}`
    })
    return { text, values }
  }
  let index = 0
  const text = sql.replace(/\?/g, () => `$${++index}`)
  return { text, values: params }
}

function normalizeRow(row: QueryResultRow | undefined) {
  if (!row) return undefined
  if (typeof row.n === "string") row.n = Number(row.n)
  return row
}
