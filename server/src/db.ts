/* Lưu trữ: SQLite có sẵn trong Node (node:sqlite) để chạy local không cần cài gì.
   Lược đồ bám theo A01/C10 (Cloud SQL Postgres trên production); kiểu dữ liệu chỉ dùng phần giao nhau của hai bên. */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Row = Record<string, any>;

/** Đồng hồ dùng chung – test tua thời gian bằng clock.set() */
export const clock = {
  offsetMs: 0,
  fixed: null as number | null,
  now(): number { return this.fixed ?? Date.now() + this.offsetMs; },
  set(ms: number) { this.fixed = ms; },
  advance(ms: number) { if (this.fixed !== null) this.fixed += ms; else this.offsetMs += ms; },
  reset() { this.fixed = null; this.offsetMs = 0; },
};
export const iso = (ms = clock.now()) => new Date(ms).toISOString();
export const H = 3_600_000;
export const D = 24 * H;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  last_step TEXT,
  product TEXT NOT NULL DEFAULT 'payment',
  device_id TEXT NOT NULL,
  device_model TEXT,
  device_rooted INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  terms_version TEXT,
  doc_type TEXT NOT NULL DEFAULT 'CCCD',
  nationality TEXT,
  passport_masked TEXT,
  id_number_hash TEXT,
  id_number_masked TEXT,
  full_name TEXT,
  dob TEXT,
  sex TEXT,
  doc_expiry TEXT,
  ocr_json TEXT,
  chip_json TEXT,
  chip_verified INTEGER,
  match_source TEXT,
  liveness REAL,
  face_match REAL,
  risk_score REAL,
  pep INTEGER NOT NULL DEFAULT 0,
  sanction INTEGER NOT NULL DEFAULT 0,
  cic_json TEXT,
  flags_json TEXT NOT NULL DEFAULT '[]',
  reasons_json TEXT NOT NULL DEFAULT '[]',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  customer_reason TEXT,
  capture_failures INTEGER NOT NULL DEFAULT 0,
  info_request_count INTEGER NOT NULL DEFAULT 0,
  resubmitted INTEGER NOT NULL DEFAULT 0,
  queued_at INTEGER,
  sla_paused_at INTEGER,
  sla_paused_ms INTEGER NOT NULL DEFAULT 0,
  escalated_at INTEGER,
  breached_at INTEGER,
  assignee_id TEXT,
  claimed_at INTEGER,
  staff_activity_at INTEGER,
  pending_maker_id TEXT,
  account_no TEXT,
  decided_at INTEGER,
  retention_until INTEGER,
  purged_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sessions_hash ON sessions(id_number_hash);
CREATE INDEX IF NOT EXISTS ix_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS ix_sessions_device ON sessions(device_id);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('GRANTED','WITHDRAWN')),
  terms_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id_number_hash TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  account_no TEXT NOT NULL,
  status TEXT NOT NULL,
  opened_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cbs_accounts (
  idempotency_key TEXT PRIMARY KEY,
  account_no TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kyc_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  maker_id TEXT,
  checker_id TEXT,
  internal_reason TEXT,
  note TEXT,
  decided_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  before_after TEXT,
  reason TEXT,
  ip_device TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS info_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  items_json TEXT NOT NULL,
  message TEXT,
  requested_by TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  reminded_at INTEGER,
  status TEXT NOT NULL,
  fulfilled_at INTEGER
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  template TEXT NOT NULL,
  channels TEXT NOT NULL,
  recipient TEXT,
  payload TEXT,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  session_id TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS velocity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_velocity ON velocity_events(kind, key, created_at);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OFFICER','LEAD','CS'))
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);

CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  affected INTEGER NOT NULL,
  detail TEXT,
  ran_at INTEGER NOT NULL
);

-- NFR-AUD-03: audit log và quyết định KYC chỉ được INSERT
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_event BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_event BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS decision_no_update BEFORE UPDATE ON kyc_decisions BEGIN SELECT RAISE(ABORT, 'kyc_decisions is immutable'); END;
CREATE TRIGGER IF NOT EXISTS decision_no_delete BEFORE DELETE ON kyc_decisions BEGIN SELECT RAISE(ABORT, 'kyc_decisions is immutable'); END;
CREATE TRIGGER IF NOT EXISTS consent_no_update BEFORE UPDATE ON consents BEGIN SELECT RAISE(ABORT, 'consents is append-only'); END;
`;

export class Db {
  raw: DatabaseSync;
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.raw.exec(SCHEMA);
    this.migrate();
  }
  /** Thêm cột mới cho DB tạo từ phiên bản trước (SQLite không có ADD COLUMN IF NOT EXISTS) */
  private migrate() {
    const cols = new Set(this.all<{ name: string }>("PRAGMA table_info(sessions)").map((c) => c.name));
    const add: [string, string][] = [["doc_type", "TEXT NOT NULL DEFAULT 'CCCD'"], ["nationality", "TEXT"], ["passport_masked", "TEXT"]];
    for (const [c, def] of add) if (!cols.has(c)) this.raw.exec(`ALTER TABLE sessions ADD COLUMN ${c} ${def}`);
  }
  all<T = Row>(sql: string, ...p: any[]): T[] { return this.raw.prepare(sql).all(...p) as T[]; }
  get<T = Row>(sql: string, ...p: any[]): T | undefined { return this.raw.prepare(sql).get(...p) as T | undefined; }
  run(sql: string, ...p: any[]) { return this.raw.prepare(sql).run(...p); }
  tx<T>(fn: () => T): T {
    this.raw.exec("BEGIN IMMEDIATE");
    try { const r = fn(); this.raw.exec("COMMIT"); return r; }
    catch (e) { this.raw.exec("ROLLBACK"); throw e; }
  }
  /** UPDATE sessions theo danh sách cột */
  patchSession(id: string, patch: Row) {
    const keys = Object.keys(patch);
    if (!keys.length) return;
    this.run(`UPDATE sessions SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...keys.map((k) => patch[k]), clock.now(), id);
  }
}
