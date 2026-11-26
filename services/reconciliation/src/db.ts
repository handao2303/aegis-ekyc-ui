/* Lưu trữ reconciliation-service – lược đồ theo R05 §2–§3 (11 bảng nghiệp vụ + audit, config, idempotency).
   Chạy local bằng node:sqlite; production là Cloud SQL Postgres (A01 §2). Chỉ dùng kiểu giao nhau của hai bên.

   Quy ước tiền: lưu số nguyên đơn vị nhỏ nhất (minor unit, 1/100) ở cột *_minor – không dùng số thực (R05 §1). */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Row = Record<string, any>;

/** Đồng hồ dùng chung – test và seed tua thời gian bằng clock.set()/advance() */
export const clock = {
  offsetMs: 0,
  fixed: null as number | null,
  now(): number { return this.fixed ?? Date.now() + this.offsetMs; },
  set(ms: number) { this.fixed = ms; },
  advance(ms: number) { if (this.fixed !== null) this.fixed += ms; else this.offsetMs += ms; },
  reset() { this.fixed = null; this.offsetMs = 0; },
};
export const H = 3_600_000;
export const D = 24 * H;

const SCHEMA = `
-- §3.1 Lô file / message đã nhận. checksum duy nhất theo nguồn (REQ-REC-14)
CREATE TABLE IF NOT EXISTS source_files (
  file_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('CBS','NAPAS','VISA','MASTERCARD','WALLET')),
  format TEXT NOT NULL CHECK (format IN ('CSV','CAMT053','CAMT054','TC33','IPM','JSON')),
  file_name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED','LOADED','QUARANTINED','RELOADED')),
  quarantine_reason TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  expected_at INTEGER,
  received_at INTEGER NOT NULL,
  loaded_at INTEGER,
  replaced_by TEXT,
  UNIQUE (source, checksum)
);

-- §3.2 Giao dịch đã chuẩn hoá. Khoá nghiệp vụ chống trùng trong cùng nguồn
CREATE TABLE IF NOT EXISTS source_transactions (
  txn_id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES source_files(file_id),
  source TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('INTERNAL','EXTERNAL')),
  reference_no TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  txn_at INTEGER NOT NULL,
  value_date TEXT,
  account_no TEXT,
  counterparty_account TEXT,
  batch_id TEXT,
  channel TEXT,
  dq_status TEXT NOT NULL CHECK (dq_status IN ('VALID','INVALID')),
  match_status TEXT NOT NULL DEFAULT 'NEW' CHECK (match_status IN ('NEW','MATCHED','IN_EXCEPTION')),
  created_at INTEGER NOT NULL,
  UNIQUE (source, reference_no, amount_minor, currency, txn_at)
);
CREATE INDEX IF NOT EXISTS ix_txn_match ON source_transactions(side, match_status);
CREATE INDEX IF NOT EXISTS ix_txn_batch ON source_transactions(batch_id);

-- §3.3 Quy tắc khớp – mỗi dòng là một version (REQ-REC-09)
CREATE TABLE IF NOT EXISTS matching_rules (
  rule_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  source_pair TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EXACT','FUZZY','N1')),
  match_keys TEXT NOT NULL,
  amount_tolerance_pct REAL,
  date_tolerance_days INTEGER,
  fuzzy_threshold REAL,
  fuzzy_gap REAL,
  n1_max_items INTEGER,
  n1_timeout_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING','ACTIVE','RETIRED')),
  change_kind TEXT NOT NULL DEFAULT 'CREATE' CHECK (change_kind IN ('CREATE','RETIRE')),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  checker_id TEXT,
  approved_by TEXT,
  approved_at INTEGER,
  reject_reason TEXT,
  effective_from INTEGER,
  retired_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (rule_id, version)
);

-- §3.4 Kết quả khớp – bất biến: chạy lại engine tạo kết quả mới
CREATE TABLE IF NOT EXISTS match_results (
  match_id TEXT PRIMARY KEY,
  rule_id TEXT,
  rule_version INTEGER,
  status TEXT NOT NULL CHECK (status IN ('MATCHED','UNMATCHED','PARTIAL')),
  score REAL NOT NULL,
  run_id TEXT NOT NULL,
  matched_by TEXT NOT NULL DEFAULT 'engine',
  matched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS match_items (
  match_id TEXT NOT NULL REFERENCES match_results(match_id),
  txn_id TEXT NOT NULL REFERENCES source_transactions(txn_id),
  side TEXT NOT NULL,
  PRIMARY KEY (match_id, txn_id)
);
CREATE INDEX IF NOT EXISTS ix_match_items_txn ON match_items(txn_id);

-- §3.5 Ngoại lệ
CREATE TABLE IF NOT EXISTS exception_cases (
  case_id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES match_results(match_id),
  kind TEXT NOT NULL CHECK (kind IN ('UNMATCHED','PARTIAL','DUPLICATE')),
  status TEXT NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','ESCALATED','PENDING_POSTING','RESOLVED')),
  source_pair TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  diff_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  owner_id TEXT,
  claimed_at INTEGER,
  escalated_at INTEGER,
  escalation_reason TEXT,
  ai_causes TEXT NOT NULL,
  root_cause_code TEXT,
  root_cause_override INTEGER NOT NULL DEFAULT 0,
  root_cause_note TEXT,
  resolution_type TEXT CHECK (resolution_type IN ('ADJUSTMENT','MANUAL_MATCH','REQUEST_DOCS')),
  manual_match_txn_id TEXT,
  docs_request_note TEXT,
  auto_healed INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_case_status ON exception_cases(status);

-- §3.6 Bút toán và dòng bút toán
CREATE TABLE IF NOT EXISTS gl_entries (
  entry_id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES exception_cases(case_id),
  match_id TEXT REFERENCES match_results(match_id),
  source_rule_id TEXT,
  source_rule_version INTEGER,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  memo TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ZERO_TOUCH','MAKER_CHECKER')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','RETURNED','REJECTED','POSTED','ESCALATED')),
  maker_id TEXT NOT NULL,
  checker_id TEXT,
  submit_count INTEGER NOT NULL DEFAULT 1,
  return_note TEXT,
  reject_reason TEXT,
  escalated_to TEXT,
  reversal_of TEXT REFERENCES gl_entries(entry_id),
  -- Bút toán sinh từ sự kiện limit.authorization.processed (REQ-REC-20)
  auth_id TEXT,
  inbound_message_id TEXT,
  business_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  posted_at INTEGER,
  -- BR-REC-10: mọi bút toán phải truy được về nguồn
  CHECK (case_id IS NOT NULL OR match_id IS NOT NULL OR reversal_of IS NOT NULL OR inbound_message_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_gl_auth ON gl_entries(auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_gl_reversal ON gl_entries(reversal_of) WHERE reversal_of IS NOT NULL AND status <> 'REJECTED';
-- REQ-REC-08 / DEF-REC-01: tối đa một bút toán đang chờ cho mỗi ngoại lệ
CREATE UNIQUE INDEX IF NOT EXISTS ux_gl_open_per_case ON gl_entries(case_id) WHERE status IN ('PENDING','RETURNED','ESCALATED');
CREATE TABLE IF NOT EXISTS gl_lines (
  entry_id TEXT NOT NULL REFERENCES gl_entries(entry_id),
  line_no INTEGER NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  account_code TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  PRIMARY KEY (entry_id, line_no)
);
CREATE TABLE IF NOT EXISTS gl_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL REFERENCES gl_entries(entry_id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

-- §3.7 Sự kiện nhận từ module khác – message_id là khoá chống trùng (REQ-REC-20)
CREATE TABLE IF NOT EXISTS inbound_events (
  message_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED','PROCESSED','FAILED')),
  entry_id TEXT,
  error TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER
);

-- §3.8 Đối chiếu cuối ngày với Hạn mức (SCRUM-53)
CREATE TABLE IF NOT EXISTS limit_ledger (
  auth_id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eod_runs (
  run_id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  ledger_count INTEGER NOT NULL DEFAULT 0,
  ledger_total_minor INTEGER NOT NULL DEFAULT 0,
  gl_count INTEGER NOT NULL DEFAULT 0,
  gl_total_minor INTEGER NOT NULL DEFAULT 0,
  diff_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS eod_diffs (
  diff_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES eod_runs(run_id),
  auth_id TEXT,
  entry_id TEXT,
  diff_type TEXT NOT NULL CHECK (diff_type IN ('MISSING_GL','MISSING_LEDGER','AMOUNT_MISMATCH')),
  owner_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  note TEXT
);

-- §1.1 Người dùng (bản dev thay SSO ở API Gateway)
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('REC_OFFICER','REC_CHECKER','REC_LEAD','FIN_VIEWER'))
);

-- §3.9 Nhật ký – cùng cấu trúc Module 1 (D01 §3.5)
CREATE TABLE IF NOT EXISTS audit_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  before_after TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Đổi tham số qua Maker-Checker như Module 1 (NFR-SEC-05)
CREATE TABLE IF NOT EXISTS config_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  object_id TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);
-- R05 §1: gọi lại cùng Idempotency-Key trả kết quả lần đầu
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  route TEXT NOT NULL,
  status INTEGER NOT NULL,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (key, actor_id, route)
);
CREATE TABLE IF NOT EXISTS sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

-- Bất biến (imm): audit chỉ thêm; kết quả khớp không sửa; bút toán POSTED không sửa, không xoá (REQ-REC-11)
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_event BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_event BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS match_no_update BEFORE UPDATE ON match_results BEGIN SELECT RAISE(ABORT, 'match_results is immutable'); END;
CREATE TRIGGER IF NOT EXISTS match_no_delete BEFORE DELETE ON match_results BEGIN SELECT RAISE(ABORT, 'match_results is immutable'); END;
CREATE TRIGGER IF NOT EXISTS gl_posted_no_update BEFORE UPDATE ON gl_entries WHEN OLD.status = 'POSTED' BEGIN SELECT RAISE(ABORT, 'posted gl_entries are immutable'); END;
CREATE TRIGGER IF NOT EXISTS gl_no_delete BEFORE DELETE ON gl_entries BEGIN SELECT RAISE(ABORT, 'gl_entries cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS gl_line_posted_no_update BEFORE UPDATE ON gl_lines
  WHEN (SELECT status FROM gl_entries WHERE entry_id = OLD.entry_id) = 'POSTED' BEGIN SELECT RAISE(ABORT, 'posted gl_lines are immutable'); END;
CREATE TRIGGER IF NOT EXISTS gl_line_posted_no_delete BEFORE DELETE ON gl_lines
  WHEN (SELECT status FROM gl_entries WHERE entry_id = OLD.entry_id) = 'POSTED' BEGIN SELECT RAISE(ABORT, 'posted gl_lines are immutable'); END;
`;

export class Db {
  raw: DatabaseSync;
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.raw.exec(SCHEMA);
  }
  all<T = Row>(sql: string, ...p: any[]): T[] { return this.raw.prepare(sql).all(...p) as T[]; }
  get<T = Row>(sql: string, ...p: any[]): T | undefined { return this.raw.prepare(sql).get(...p) as T | undefined; }
  run(sql: string, ...p: any[]) { return this.raw.prepare(sql).run(...p); }

  /** Giao dịch DB lồng được: chỉ lớp ngoài cùng BEGIN/COMMIT, lớp trong dùng SAVEPOINT */
  private depth = 0;
  tx<T>(fn: () => T): T {
    const sp = `sp${this.depth}`;
    this.raw.exec(this.depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
    this.depth++;
    try {
      const r = fn();
      this.depth--;
      this.raw.exec(this.depth === 0 ? "COMMIT" : `RELEASE ${sp}`);
      return r;
    } catch (e) {
      this.depth--;
      this.raw.exec(this.depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw e;
    }
  }

  /** Mã tuần tự có tiền tố, vd. EXC-1120, GL-90309 – không dùng AUTOINCREMENT để giữ định dạng nghiệp vụ */
  nextId(name: string, prefix: string, start: number, pad = 0): string {
    const cur = this.get<{ value: number }>("SELECT value FROM sequences WHERE name = ?", name);
    const v = cur ? cur.value + 1 : start;
    this.run("INSERT INTO sequences(name, value) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value", name, v);
    return `${prefix}${String(v).padStart(pad, "0")}`;
  }

  /** UPDATE một dòng theo danh sách cột (tên cột do code truyền, không bao giờ lấy từ input người dùng) */
  patch(table: string, keyCol: string, key: string, patch: Row) {
    const cols = Object.keys(patch);
    if (!cols.length) return;
    this.run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE ${keyCol} = ?`, ...cols.map((c) => patch[c]), key);
  }
}
