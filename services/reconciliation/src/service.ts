/* reconciliation-service – nghiệp vụ Đối soát (R01, R05). Mỗi phương thức ghi rõ yêu cầu nguồn.

   Nguyên tắc chung:
   - Mọi kiểm soát phân tách nhiệm vụ (SoD-1/2/3) chạy ở server, không dựa vào việc UI ẩn nút (R05 §1.1).
   - Thay đổi trạng thái ngoại lệ ↔ bút toán nằm trong một giao dịch DB (R05 §4.2).
   - Lần bị chặn vì SoD vẫn ghi audit SOD_BLOCKED (ghi ngoài giao dịch để không bị rollback). */
import { clock, D, H, type Db, type Row } from "./db.ts";
import { CONFIG_BOUNDS, DEFAULT_CONFIG, type Config, type ConfigKey } from "./config.ts";
import { ApiError, forbidden, invalidState, notFound, validation } from "./errors.ts";
import { currency as ccy, fromMinor, toMinor, vnd } from "./money.ts";
import { assertIngestInput, parseRecords, sha256 } from "./ingest.ts";
import { CAUSE_CATALOGUE, parsePair, runEngine, suggestCauses, vnDate, type Cause, type CauseCode, type MatchKey, type Rule, type Txn } from "./engine.ts";

/* ---------- Vai trò (R05 §1.1) ---------- */
export type Role = "REC_OFFICER" | "REC_CHECKER" | "REC_LEAD" | "FIN_VIEWER";
export type Staff = { id: string; name: string; role: Role };
const SYSTEM: Staff = { id: "system", name: "Hệ thống", role: "REC_LEAD" };
const REC: Role[] = ["REC_OFFICER", "REC_CHECKER", "REC_LEAD"];
const RULE_APPROVERS: Role[] = ["REC_CHECKER", "REC_LEAD", "FIN_VIEWER"];
const GL_APPROVERS: Role[] = ["REC_CHECKER", "REC_LEAD"];
const UNMASK: Role[] = ["REC_LEAD", "FIN_VIEWER"];

const OPEN_CASE = ["OPEN", "IN_PROGRESS", "ESCALATED", "PENDING_POSTING"];
const KEYS: MatchKey[] = ["REF", "AMOUNT", "CURRENCY", "DATE", "ACCOUNT", "BATCH"];
const ACCOUNT_CODE = /^\d{4}(\.\d{2})?$/;
const j = <T>(s: string | null | undefined, d: T): T => (s ? (JSON.parse(s) as T) : d);

/** Che số tài khoản giữ 4 số đầu và 4 số cuối [D-REC-09]; số thẻ đã che từ lúc nạp */
export function maskAccount(v: string | null): string | null {
  if (!v || v.includes("•") || v.startsWith("GL ")) return v;
  const d = v.replace(/\s/g, "");
  return d.length <= 8 ? v : `${d.slice(0, 4)} •••• ${d.slice(-4)}`;
}

export class RecService {
  db: Db;
  constructor(db: Db) { this.db = db; }

  /* ================= Hạ tầng: người dùng, cấu hình, audit, sự kiện ================= */

  staff(id: string | undefined): Staff {
    if (!id) throw new ApiError(401, "UNAUTHENTICATED", "Thiếu danh tính người dùng (x-staff-id)");
    const s = this.db.get<Staff>("SELECT id, name, role FROM staff WHERE id = ?", id);
    if (!s) throw new ApiError(401, "UNAUTHENTICATED", "Người dùng không tồn tại");
    return s;
  }
  private require(s: Staff, roles: Role[], what = "thao tác này") {
    if (!roles.includes(s.role)) throw forbidden(`Vai trò ${s.role} không được ${what}`);
  }
  private nameOf(id: string | null | undefined) {
    if (!id) return null;
    if (id === "system") return "system";
    return this.db.get<{ name: string }>("SELECT name FROM staff WHERE id = ?", id)?.name ?? id;
  }

  cfg(): Config {
    const c: Row = { ...DEFAULT_CONFIG };
    for (const r of this.db.all<{ key: string; value: string }>("SELECT key, value FROM config")) c[r.key] = JSON.parse(r.value);
    return c as Config;
  }
  private note(v: unknown, field: string): string {
    const s = String(v ?? "").trim();
    const min = this.cfg().min_note_length;
    if (s.length < min) throw validation(`${field} tối thiểu ${min} ký tự`, "NOTE_TOO_SHORT", { min });
    return s;
  }

  audit(actor: Staff, action: string, objectId: string | null, beforeAfter?: Row, reason?: string) {
    this.db.run("INSERT INTO audit_event(object_id, actor_id, role, action, before_after, reason, created_at) VALUES(?,?,?,?,?,?,?)",
      objectId, actor.id, actor.role, action, beforeAfter ? JSON.stringify(beforeAfter) : null, reason ?? null, clock.now());
  }
  /** Ghi audit rồi ném lỗi SoD – audit ghi ngoài giao dịch nên còn lại sau rollback */
  private sodBlock(actor: Staff, objectId: string, code: string, message: string): never {
    this.audit(actor, "SOD_BLOCKED", objectId, { code }, message);
    throw forbidden(message, code);
  }
  private emit(type: string, objectId: string | null, payload: Row = {}) {
    this.db.run("INSERT INTO events(type, object_id, payload, created_at) VALUES(?,?,?,?)", type, objectId, JSON.stringify(payload), clock.now());
  }

  /* ================= §5.1 Nạp dữ liệu và nguồn (UC-REC-01) ================= */

  /** Job nạp file (TC-REC-B01/B02). Production gọi từ SFTP watcher; bản dev mở qua /api/v1/rec/dev/ingest */
  ingestFile(input: { source: string; format: string; file_name: string; content: string; expected_at?: number }, actor: Staff = SYSTEM) {
    assertIngestInput(input);
    const checksum = sha256(input.content);
    const dup = this.db.get("SELECT file_id, record_count FROM source_files WHERE source = ? AND checksum = ?", input.source, checksum);
    if (dup) {
      // REQ-REC-14: cùng nội dung → không tạo lô, không tạo giao dịch; ghi số bản ghi bị loại
      this.audit(actor, "FILE_DUPLICATE", dup.file_id, { duplicate_count: dup.record_count, file_name: input.file_name });
      return { file_id: dup.file_id, status: "DUPLICATE_FILE", loaded: 0, duplicate_count: dup.record_count as number, invalid_count: 0 };
    }
    const side = input.source === "CBS" ? "INTERNAL" : "EXTERNAL";
    const { records, errors } = parseRecords(input.format, input.content, side);
    const now = clock.now();
    return this.db.tx(() => {
      const fileId = this.db.nextId(`file-${vnDate(now)}-${input.source}`, `F-${vnDate(now).replaceAll("-", "")}-${input.source.slice(0, 3)}-`, 1, 2);
      if (errors.length) {
        const reason = errors.slice(0, 3).join("; ") + (errors.length > 3 ? ` (+${errors.length - 3} lỗi khác)` : "");
        this.db.run(`INSERT INTO source_files(file_id, source, format, file_name, checksum, status, quarantine_reason, record_count, invalid_count, expected_at, received_at)
          VALUES(?,?,?,?,?, 'QUARANTINED', ?, ?, ?, ?, ?)`, fileId, input.source, input.format, input.file_name, checksum, reason, records.length + errors.length, errors.length, input.expected_at ?? null, now);
        this.audit(actor, "FILE_QUARANTINED", fileId, { invalid_count: errors.length }, reason);
        this.emit("rec.file.quarantined", fileId, { source: input.source, reason });
        return { file_id: fileId, status: "QUARANTINED", loaded: 0, duplicate_count: 0, invalid_count: errors.length, reason };
      }
      this.db.run(`INSERT INTO source_files(file_id, source, format, file_name, checksum, status, record_count, expected_at, received_at)
        VALUES(?,?,?,?,?, 'RECEIVED', ?, ?, ?)`, fileId, input.source, input.format, input.file_name, checksum, records.length, input.expected_at ?? null, now);
      let loaded = 0, duplicates = 0;
      for (const r of records) {
        const txnId = this.db.nextId("txn", "T-", 1, 6);
        const res = this.db.run(`INSERT OR IGNORE INTO source_transactions(txn_id, file_id, source, side, reference_no, amount_minor, currency, direction, txn_at, value_date,
          account_no, counterparty_account, batch_id, channel, dq_status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'VALID', ?)`,
          txnId, fileId, input.source, r.side, r.reference_no, r.amount_minor, r.currency, r.direction, r.txn_at, r.value_date,
          r.account_no, r.counterparty_account, r.batch_id, r.channel, now);
        if (Number(res.changes)) loaded++; else duplicates++; // trùng khoá nghiệp vụ (source, ref, amount, ccy, txn_at)
      }
      this.db.patch("source_files", "file_id", fileId, { status: "LOADED", loaded_at: clock.now(), duplicate_count: duplicates });
      return { file_id: fileId, status: "LOADED", loaded, duplicate_count: duplicates, invalid_count: 0 };
    });
  }

  /** API-01 – trạng thái từng nguồn: Đúng lịch / Trễ / Cách ly (UAT-REC-02, 09) */
  sources() {
    return (["CBS", "NAPAS", "VISA", "MASTERCARD", "WALLET"] as const).map((src) => {
      const last = this.db.get("SELECT * FROM source_files WHERE source = ? ORDER BY received_at DESC, file_id DESC LIMIT 1", src);
      const cnt = this.db.get<{ n: number; m: number }>(
        "SELECT count(*) n, sum(match_status = 'MATCHED') m FROM source_transactions WHERE source = ? AND dq_status = 'VALID'", src) ?? { n: 0, m: 0 };
      const delayed = last && last.expected_at && last.received_at - last.expected_at > 30 * 60_000;
      const status = !last ? "NO_DATA" : last.status === "QUARANTINED" ? "QUARANTINED" : delayed ? "DELAYED" : "ON_SCHEDULE";
      return {
        source: src, status, records: cnt.n, match_rate: cnt.n ? Math.round(((cnt.m ?? 0) / cnt.n) * 1000) / 10 : 0,
        last_file_id: last?.file_id ?? null, last_updated_at: last?.loaded_at ?? last?.received_at ?? null,
        delay_minutes: delayed ? Math.round((last!.received_at - last!.expected_at) / 60_000) : 0,
        quarantine_reason: last?.status === "QUARANTINED" ? last.quarantine_reason : null,
      };
    });
  }

  /** API-02, 03 */
  files(actor: Staff, q: { status?: string | null; source?: string | null }) {
    this.require(actor, REC, "xem lô file");
    return this.db.all(`SELECT * FROM source_files WHERE (? IS NULL OR status = ?) AND (? IS NULL OR source = ?) ORDER BY received_at DESC`,
      q.status ?? null, q.status ?? null, q.source ?? null, q.source ?? null);
  }
  file(actor: Staff, fileId: string) {
    this.require(actor, REC, "xem lô file");
    return this.db.get("SELECT * FROM source_files WHERE file_id = ?", fileId) ?? (() => { throw notFound(`lô ${fileId}`); })();
  }

  /** API-04 – nạp lại lô bị cách ly bằng file nguồn gửi lại (REQ-REC-13) */
  reloadFile(actor: Staff, fileId: string, body: { replacement_file_id?: string; file_name?: string; content?: string; format?: string }) {
    this.require(actor, ["REC_LEAD"], "nạp lại lô");
    const f = this.file(actor, fileId);
    if (f.status !== "QUARANTINED") throw new ApiError(409, "FILE_NOT_QUARANTINED", `Lô ${fileId} không ở trạng thái cách ly`);
    let replacement = body.replacement_file_id ? this.db.get("SELECT * FROM source_files WHERE file_id = ?", body.replacement_file_id) : null;
    if (!replacement) {
      const r = this.ingestFile({ source: f.source, format: body.format ?? f.format, file_name: body.file_name ?? `${f.file_name} (nạp lại)`, content: String(body.content ?? "") }, actor);
      if (r.status !== "LOADED") throw validation(`File thay thế không nạp được: ${r.status}${"reason" in r ? ` – ${r.reason}` : ""}`);
      replacement = this.db.get("SELECT * FROM source_files WHERE file_id = ?", r.file_id);
    } else if (replacement.source !== f.source || replacement.status !== "LOADED") throw validation("Lô thay thế phải cùng nguồn và đã nạp thành công");
    this.db.patch("source_files", "file_id", fileId, { status: "RELOADED", replaced_by: replacement!.file_id });
    this.audit(actor, "FILE_RELOADED", fileId, { replaced_by: replacement!.file_id });
    return { file_id: fileId, status: "RELOADED", replaced_by: replacement!.file_id };
  }

  /* ================= §5.2 Quy tắc khớp (UC-REC-02, REQ-REC-09) ================= */

  private ruleRow(r: Row) {
    return {
      rule_id: r.rule_id, version: r.version, name: r.name, source_pair: r.source_pair, type: r.type, match_keys: j<string[]>(r.match_keys, []),
      amount_tolerance_pct: r.amount_tolerance_pct, date_tolerance_days: r.date_tolerance_days, fuzzy_threshold: r.fuzzy_threshold,
      fuzzy_gap: r.fuzzy_gap, n1_max_items: r.n1_max_items, n1_timeout_ms: r.n1_timeout_ms,
      status: r.status, change_kind: r.change_kind, created_by: r.created_by, created_by_name: this.nameOf(r.created_by),
      updated_by: r.updated_by, checker_id: r.checker_id, checker_name: this.nameOf(r.checker_id), approved_by: r.approved_by,
      approved_by_name: this.nameOf(r.approved_by), approved_at: r.approved_at, reject_reason: r.reject_reason,
      effective_from: r.effective_from, retired_at: r.retired_at, created_at: r.created_at,
    };
  }

  /** API-10 – mỗi quy tắc một dòng: version mới nhất chưa ngừng (DRAFT/PENDING nếu đang sửa, không thì ACTIVE) + tỷ lệ trúng */
  rules(status?: string | null) {
    const ids = this.db.all<{ rule_id: string }>("SELECT DISTINCT rule_id FROM matching_rules ORDER BY rule_id").map((r) => r.rule_id);
    const totalMatched = this.db.get<{ n: number }>("SELECT count(*) n FROM match_results WHERE status = 'MATCHED'")!.n || 1;
    return ids.map((id) => {
      const versions = this.db.all("SELECT * FROM matching_rules WHERE rule_id = ? ORDER BY version DESC", id);
      const head = versions.find((v) => v.status !== "RETIRED" && v.change_kind === "CREATE") ?? versions[0];
      const pendingRetire = versions.find((v) => v.change_kind === "RETIRE" && v.status === "PENDING");
      const active = versions.find((v) => v.status === "ACTIVE");
      const hits = this.db.get<{ n: number }>("SELECT count(*) n FROM match_results WHERE rule_id = ? AND status = 'MATCHED'", id)!.n;
      return { ...this.ruleRow(pendingRetire ?? head), active_version: active?.version ?? null, hit_rate: Math.round((hits / totalMatched) * 1000) / 10 };
    }).filter((r) => !status || r.status === status);
  }
  /** API-11 – mọi version */
  rule(ruleId: string) {
    const v = this.db.all("SELECT * FROM matching_rules WHERE rule_id = ? ORDER BY version DESC", ruleId);
    if (!v.length) throw notFound(`quy tắc ${ruleId}`);
    return { rule_id: ruleId, versions: v.map((r) => this.ruleRow(r)) };
  }

  private validateRule(b: any) {
    const name = String(b?.name ?? "").trim();
    if (name.length < 4) throw validation("Tên quy tắc tối thiểu 4 ký tự");
    if (!["EXACT", "FUZZY", "N1"].includes(b?.type)) throw validation("type phải là EXACT, FUZZY hoặc N1");
    try { parsePair(String(b?.source_pair ?? "")); } catch { throw validation("source_pair dạng 'CBS↔NAPAS'"); }
    let keys = Array.isArray(b?.match_keys) ? b.match_keys.map((k: string) => String(k).toUpperCase()) : [];
    if (!keys.length || keys.some((k: string) => !KEYS.includes(k as MatchKey))) throw validation(`match_keys phải có ít nhất 1 khoá trong ${KEYS.join(", ")}`);
    if (b.type === "EXACT" && !keys.includes("CURRENCY")) keys = [...keys, "CURRENCY"]; // R03 §4
    const fuzzyOnly = ["amount_tolerance_pct", "date_tolerance_days"];
    if (b.type !== "FUZZY" && fuzzyOnly.some((k) => b[k] !== undefined && b[k] !== null)) throw validation("Dung sai số tiền / ngày chỉ dùng cho FUZZY");
    const range = (k: string, lo: number, hi: number) => {
      if (b[k] === undefined || b[k] === null) return null;
      const n = Number(b[k]);
      if (!Number.isFinite(n) || n < lo || n > hi) throw validation(`${k} phải trong [${lo}, ${hi}]`, "OUT_OF_RANGE", { field: k, min: lo, max: hi });
      return n;
    };
    return {
      name, type: b.type, source_pair: String(b.source_pair).replace("<->", "↔").toUpperCase(), match_keys: JSON.stringify([...new Set(keys)]),
      amount_tolerance_pct: range("amount_tolerance_pct", 0, 5), date_tolerance_days: range("date_tolerance_days", 0, 7),
      fuzzy_threshold: range("fuzzy_threshold", 0.8, 1), fuzzy_gap: range("fuzzy_gap", 0, 0.1),
      n1_max_items: range("n1_max_items", 2, 200), n1_timeout_ms: range("n1_timeout_ms", 100, 10_000),
    };
  }
  private insertRule(ruleId: string, version: number, v: Row, actor: Staff, extra: Row = {}) {
    const row = { rule_id: ruleId, version, ...v, status: "DRAFT", change_kind: "CREATE", created_by: actor.id, updated_by: actor.id, created_at: clock.now(), ...extra };
    const cols = Object.keys(row);
    this.db.run(`INSERT INTO matching_rules(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`, ...cols.map((c) => (row as Row)[c]));
    return this.ruleRow(this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? AND version = ?", ruleId, version)!);
  }
  private openVersion(ruleId: string) {
    return this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? AND status IN ('DRAFT','PENDING') ORDER BY version DESC LIMIT 1", ruleId);
  }

  /** API-12 – tạo DRAFT version 1 */
  createRule(actor: Staff, body: any) {
    this.require(actor, REC, "tạo quy tắc");
    const v = this.validateRule(body);
    return this.db.tx(() => {
      const max = this.db.get<{ n: number }>("SELECT max(CAST(substr(rule_id, 4) AS INTEGER)) n FROM matching_rules")?.n ?? 0;
      const id = `MR-${String(max + 1).padStart(3, "0")}`;
      const r = this.insertRule(id, 1, v, actor);
      this.audit(actor, "RULE_CREATED", id, { version: 1 });
      return r;
    });
  }

  /** API-13 – gửi duyệt. Checker phải khác người tạo (UAT-REC-08) */
  submitRule(actor: Staff, ruleId: string, body: { version?: number; checker_id?: string }) {
    const r = this.openVersion(ruleId);
    if (!r || r.status !== "DRAFT" || (body.version && body.version !== r.version)) throw invalidState("Không có version DRAFT để gửi duyệt");
    if (r.created_by !== actor.id) throw forbidden("Chỉ người tạo version được gửi duyệt");
    if (!body.checker_id || body.checker_id === actor.id) this.sodBlock(actor, ruleId, "RULE_SELF_APPROVAL", "Vi phạm phân tách nhiệm vụ: Checker phải khác người tạo quy tắc (RULE-REC-05)");
    const checker = this.staff(body.checker_id);
    if (!RULE_APPROVERS.includes(checker.role)) throw validation(`${checker.name} không có quyền duyệt quy tắc`);
    this.db.run("UPDATE matching_rules SET status = 'PENDING', checker_id = ?, reject_reason = NULL WHERE rule_id = ? AND version = ?", checker.id, ruleId, r.version);
    this.audit(actor, "RULE_SUBMITTED", ruleId, { version: r.version, checker_id: checker.id });
    return this.ruleRow(this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? AND version = ?", ruleId, r.version)!);
  }

  /** API-14 – duyệt / trả lại. SoD-3: người duyệt ≠ người tạo version. Duyệt version mới → version cũ RETIRED */
  decideRule(actor: Staff, ruleId: string, approve: boolean, reason?: string) {
    this.require(actor, RULE_APPROVERS, "duyệt quy tắc");
    const r = this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? AND status = 'PENDING' ORDER BY version DESC LIMIT 1", ruleId);
    if (!r) throw invalidState(`Quy tắc ${ruleId} không có version chờ duyệt`);
    if (r.created_by === actor.id) this.sodBlock(actor, ruleId, "RULE_SELF_APPROVAL", `Không thể duyệt ${ruleId}: bạn là người tạo quy tắc`);
    const now = clock.now();
    if (!approve) {
      const why = this.note(reason, "Lý do trả lại");
      this.db.run("UPDATE matching_rules SET status = 'DRAFT', reject_reason = ? WHERE rule_id = ? AND version = ?", why, ruleId, r.version);
      this.audit(actor, "RULE_REJECTED", ruleId, { version: r.version }, why);
      return this.rule(ruleId);
    }
    this.db.tx(() => {
      this.db.run("UPDATE matching_rules SET status = 'RETIRED', retired_at = ? WHERE rule_id = ? AND status = 'ACTIVE'", now, ruleId);
      if (r.change_kind === "RETIRE") {
        this.db.run("UPDATE matching_rules SET status = 'RETIRED', approved_by = ?, approved_at = ?, retired_at = ? WHERE rule_id = ? AND version = ?", actor.id, now, now, ruleId, r.version);
        this.audit(actor, "RULE_RETIRED", ruleId, { version: r.version });
      } else {
        this.db.run("UPDATE matching_rules SET status = 'ACTIVE', approved_by = ?, approved_at = ?, effective_from = ? WHERE rule_id = ? AND version = ?", actor.id, now, now, ruleId, r.version);
        this.audit(actor, "RULE_APPROVED", ruleId, { version: r.version });
      }
    });
    return this.rule(ruleId);
  }

  /** API-15 – sửa quy tắc đang chạy: version mới DRAFT, version cũ vẫn chạy */
  newRuleVersion(actor: Staff, ruleId: string, body: any) {
    this.require(actor, REC, "sửa quy tắc");
    const latest = this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? ORDER BY version DESC LIMIT 1", ruleId);
    if (!latest) throw notFound(`quy tắc ${ruleId}`);
    if (this.openVersion(ruleId)) throw invalidState(`${ruleId} đã có version đang soạn hoặc chờ duyệt`);
    const base = this.ruleRow(latest);
    const v = this.validateRule({ ...base, ...body });
    const r = this.insertRule(ruleId, latest.version + 1, v, actor);
    this.audit(actor, "RULE_CREATED", ruleId, { version: r.version, from: latest.version });
    return r;
  }

  /** API-16 – yêu cầu ngừng dùng, qua duyệt như mọi thay đổi */
  retireRule(actor: Staff, ruleId: string, body: { checker_id?: string; reason?: string }) {
    this.require(actor, REC, "ngừng quy tắc");
    const active = this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? AND status = 'ACTIVE'", ruleId);
    if (!active) throw invalidState(`${ruleId} không có version đang chạy`);
    if (this.openVersion(ruleId)) throw invalidState(`${ruleId} đã có version đang soạn hoặc chờ duyệt`);
    if (!body.checker_id || body.checker_id === actor.id) this.sodBlock(actor, ruleId, "RULE_SELF_APPROVAL", "Vi phạm phân tách nhiệm vụ: Checker phải khác người yêu cầu");
    const why = this.note(body.reason, "Lý do ngừng dùng");
    const v = this.validateRule(this.ruleRow(active));
    const r = this.insertRule(ruleId, active.version + 1, v, actor, { status: "PENDING", change_kind: "RETIRE", checker_id: this.staff(body.checker_id).id });
    this.audit(actor, "RULE_SUBMITTED", ruleId, { version: r.version, change_kind: "RETIRE" }, why);
    return r;
  }

  /** API-17 – sao chép thành quy tắc mới (REQ-REC-12) */
  copyRule(actor: Staff, ruleId: string) {
    const src = this.db.get("SELECT * FROM matching_rules WHERE rule_id = ? ORDER BY version DESC LIMIT 1", ruleId);
    if (!src) throw notFound(`quy tắc ${ruleId}`);
    const b = this.ruleRow(src);
    return this.createRule(actor, { ...b, name: `${b.name} (bản sao)` });
  }

  /* ================= Engine (UC-REC-03) ================= */

  /** Chạy engine trên giao dịch NEW. Mọi kết quả ghi bất biến; ngoại lệ có gợi ý nguyên nhân và hạn xử lý */
  runMatching() {
    const c = this.cfg();
    const txns = this.db.all<Txn>("SELECT * FROM source_transactions WHERE match_status = 'NEW' AND dq_status = 'VALID'");
    const rules = this.db.all("SELECT * FROM matching_rules WHERE status = 'ACTIVE'").map((r): Rule => ({ ...r, match_keys: j<MatchKey[]>(r.match_keys, []) } as Rule));
    const outcomes = runEngine(txns, rules, { fuzzy_threshold: c.fuzzy_threshold, fuzzy_gap: c.fuzzy_gap, partial_floor: c.partial_floor, n1_timeout_ms: c.n1_timeout_ms, n1_max_items: c.n1_max_items });
    const now = clock.now();
    const runId = this.db.nextId(`run-${vnDate(now)}`, `RUN-${vnDate(now).replaceAll("-", "")}-`, 1, 3);
    const summary = { run_id: runId, matched: 0, exceptions: 0, settlements: 0 };
    this.db.tx(() => {
      for (const o of outcomes) {
        const status = o.status === "DUPLICATE" ? "UNMATCHED" : o.status;
        const matchId = this.db.nextId("match", "M-", 1, 7);
        this.db.run("INSERT INTO match_results(match_id, rule_id, rule_version, status, score, run_id, matched_at) VALUES(?,?,?,?,?,?,?)",
          matchId, o.rule?.rule_id ?? null, o.rule?.version ?? null, status, o.score, runId, now);
        for (const t of [o.internal, ...o.external]) this.db.run("INSERT INTO match_items(match_id, txn_id, side) VALUES(?,?,?)", matchId, t.txn_id, t.side);
        if (o.status === "MATCHED") {
          summary.matched++;
          for (const t of [o.internal, ...o.external]) this.db.run("UPDATE source_transactions SET match_status = 'MATCHED' WHERE txn_id = ?", t.txn_id);
          // Tất toán lô N:1 của tổ chức thẻ sinh bút toán tự động (BR-REC-10, ví dụ GL-90311)
          if (o.rule.type === "N1") { this.autoSettlement(matchId, o.rule, o.internal); summary.settlements++; }
          continue;
        }
        summary.exceptions++;
        for (const t of [o.internal, ...o.external]) this.db.run("UPDATE source_transactions SET match_status = 'IN_EXCEPTION' WHERE txn_id = ?", t.txn_id);
        const pair = o.rule?.source_pair ?? `${o.internal.source}↔${o.internal.channel ?? "?"}`;
        const partner = parsePair(pair)[1];
        const fx = o.external.some((e) => e.source === "VISA" || e.source === "MASTERCARD") && o.status === "PARTIAL";
        const caseId = this.db.nextId("case", "EXC-", 1120);
        this.db.run(`INSERT INTO exception_cases(case_id, match_id, kind, status, source_pair, amount_minor, diff_minor, currency, opened_at, due_at, ai_causes)
          VALUES(?,?,?, 'OPEN', ?,?,?,?,?,?,?)`, caseId, matchId, o.status, pair, o.internal.amount_minor, o.diff_minor, o.internal.currency,
          now, now + c.escalation_after_hours * H, JSON.stringify(suggestCauses(o.hint, { fx, partner })));
        this.emit("rec.exception.created", caseId, { kind: o.status, pair });
      }
    });
    return summary;
  }

  private autoSettlement(matchId: string, rule: Rule, internal: Txn) {
    const c = this.cfg();
    this.createEntry({
      match_id: matchId, source_rule_id: rule.rule_id, source_rule_version: rule.version, amount: internal.amount_minor, currency: internal.currency,
      memo: `Tất toán lô ${internal.batch_id ?? internal.reference_no}`, maker: SYSTEM,
      lines: [{ side: "DEBIT", account_code: c.gl_settlement_debit, amount_minor: internal.amount_minor }, { side: "CREDIT", account_code: c.gl_settlement_credit, amount_minor: internal.amount_minor }],
    });
  }

  /* ================= §5.3 Ngoại lệ (UC-REC-04) ================= */

  private caseOrThrow(caseId: string) {
    return this.db.get("SELECT * FROM exception_cases WHERE case_id = ?", caseId) ?? (() => { throw notFound(`ngoại lệ ${caseId}`); })();
  }
  private ruleOfMatch(matchId: string | null) {
    if (!matchId) return null;
    const m = this.db.get("SELECT rule_id, rule_version FROM match_results WHERE match_id = ?", matchId);
    if (!m?.rule_id) return null;
    return this.db.get("SELECT rule_id, version, created_by, updated_by FROM matching_rules WHERE rule_id = ? AND version = ?", m.rule_id, m.rule_version) ?? null;
  }
  private txnView(t: Row | undefined, unmask: boolean) {
    if (!t) return null;
    return {
      txn_id: t.txn_id, source: t.source, reference_no: t.reference_no, amount: fromMinor(t.amount_minor), amount_minor: t.amount_minor, currency: t.currency,
      txn_at: t.txn_at, account: unmask ? t.account_no : maskAccount(t.account_no), batch_id: t.batch_id, direction: t.direction,
    };
  }
  private aging(openedAt: number) {
    const h = (clock.now() - openedAt) / H;
    return h < 24 ? "0-1D" : h < 72 ? "1-3D" : h < 168 ? "3-7D" : ">7D"; // [D-REC-02] UI mẫu có thêm 3-7D
  }
  private openEntryOf(caseId: string) {
    return this.db.get("SELECT * FROM gl_entries WHERE case_id = ? AND status IN ('PENDING','RETURNED','ESCALATED')", caseId);
  }
  private caseView(c: Row, unmask = false) {
    const items = this.db.all("SELECT t.* FROM match_items mi JOIN source_transactions t ON t.txn_id = mi.txn_id WHERE mi.match_id = ? ORDER BY mi.side DESC", c.match_id);
    const rule = this.ruleOfMatch(c.match_id);
    const manual = c.manual_match_txn_id ? this.db.get("SELECT * FROM source_transactions WHERE txn_id = ?", c.manual_match_txn_id) : undefined;
    const pending = this.openEntryOf(c.case_id);
    const now = clock.now();
    return {
      case_id: c.case_id, kind: c.kind, status: c.status, source_pair: c.source_pair,
      amount: fromMinor(c.amount_minor), amount_minor: c.amount_minor, diff: fromMinor(c.diff_minor), diff_minor: c.diff_minor, currency: c.currency,
      opened_at: c.opened_at, due_at: c.due_at, age_hours: Math.floor((now - c.opened_at) / H), due_hours: Math.round((c.due_at - c.opened_at) / H),
      aging_bucket: this.aging(c.opened_at), overdue: OPEN_CASE.includes(c.status) && now > c.due_at,
      owner_id: c.owner_id, owner_name: this.nameOf(c.owner_id), claimed_at: c.claimed_at,
      escalated_at: c.escalated_at, escalation_reason: c.escalation_reason,
      ai_causes: j<Cause[]>(c.ai_causes, []),
      rule_id: rule?.rule_id ?? null, rule_version: rule?.version ?? null, rule_created_by: rule?.created_by ?? null, rule_created_by_name: this.nameOf(rule?.created_by),
      internal: this.txnView(items.find((t) => t.side === "INTERNAL"), unmask),
      external: this.txnView(items.find((t) => t.side === "EXTERNAL") ?? manual, unmask),
      external_count: items.filter((t) => t.side === "EXTERNAL").length,
      resolution: c.resolution_type ? {
        type: c.resolution_type, root_cause_code: c.root_cause_code, override: !!c.root_cause_override, note: c.root_cause_note,
        manual_match_txn_id: c.manual_match_txn_id, manual_match_ref: manual?.reference_no ?? null,
      } : null,
      waiting_docs: c.status === "IN_PROGRESS" && c.resolution_type === "REQUEST_DOCS" ? c.docs_request_note : null,
      pending_entry: pending ? { entry_id: pending.entry_id, status: pending.status, amount: fromMinor(pending.amount_minor), amount_minor: pending.amount_minor } : null,
      closed_at: c.closed_at,
    };
  }

  /** API-20 – open = mọi trạng thái trừ RESOLVED (gồm PENDING_POSTING – TC-REC-21) */
  exceptions(q: { status?: string | null; kind?: string | null; source?: string | null; q?: string | null }) {
    const st = q.status ?? "open";
    const rows = this.db.all(`SELECT * FROM exception_cases WHERE (? = 'all' OR (? = 'open' AND status <> 'RESOLVED') OR status = ?)
      AND (? IS NULL OR kind = ?) AND (? IS NULL OR source_pair LIKE '%' || ? || '%') ORDER BY opened_at ASC`,
      st, st, st, q.kind ?? null, q.kind ?? null, q.source ?? null, q.source ?? null);
    const needle = q.q?.trim().toUpperCase();
    return rows.map((c) => this.caseView(c)).filter((v) => !needle || [v.case_id, v.internal?.reference_no, v.external?.reference_no, v.rule_id].some((x) => x?.toUpperCase().includes(needle)));
  }

  /** API-21 – xem đủ số tài khoản chỉ REC_LEAD, FIN_VIEWER và có audit VIEW_ACCOUNT */
  exception(actor: Staff, caseId: string, unmask = false) {
    const c = this.caseOrThrow(caseId);
    if (unmask) {
      if (!UNMASK.includes(actor.role)) throw forbidden("Không được xem đầy đủ số tài khoản");
      this.audit(actor, "VIEW_ACCOUNT", caseId);
    }
    return { ...this.caseView(c, unmask), lineage: this.lineage({ case_id: caseId }) };
  }

  /** API-22 – nhận xử lý. Ngoại lệ đã leo thang chỉ REC_LEAD nhận */
  claim(actor: Staff, caseId: string) {
    this.require(actor, REC, "nhận ngoại lệ");
    const c = this.caseOrThrow(caseId);
    if (c.status === "RESOLVED") throw invalidState("Ngoại lệ đã đóng");
    if (c.owner_id && c.owner_id !== actor.id) throw new ApiError(409, "ALREADY_CLAIMED", `${this.nameOf(c.owner_id)} đang xử lý ngoại lệ này`, { owner_id: c.owner_id, owner_name: this.nameOf(c.owner_id) });
    if (c.status === "ESCALATED" && actor.role !== "REC_LEAD") throw forbidden("Ngoại lệ đã leo thang – chỉ trưởng nhóm nhận xử lý");
    this.db.patch("exception_cases", "case_id", caseId, { owner_id: actor.id, claimed_at: clock.now(), status: c.status === "OPEN" ? "IN_PROGRESS" : c.status });
    this.audit(actor, "CASE_CLAIMED", caseId);
    return this.caseView(this.caseOrThrow(caseId));
  }
  release(actor: Staff, caseId: string) {
    const c = this.caseOrThrow(caseId);
    if (c.owner_id !== actor.id && actor.role !== "REC_LEAD") throw forbidden("Chỉ người đang giữ hoặc trưởng nhóm được nhả ngoại lệ", "NOT_ASSIGNEE");
    if (c.status === "PENDING_POSTING") throw invalidState("Ngoại lệ đang chờ hạch toán, không nhả được");
    this.db.patch("exception_cases", "case_id", caseId, { owner_id: null, claimed_at: null, status: c.status === "IN_PROGRESS" ? "OPEN" : c.status });
    this.audit(actor, "CASE_RELEASED", caseId);
    return this.caseView(this.caseOrThrow(caseId));
  }

  /** API-23 – leo thang bằng tay (REQ-REC-03) */
  escalate(actor: Staff, caseId: string, reason: unknown) {
    const c = this.caseOrThrow(caseId);
    if (c.owner_id !== actor.id && actor.role !== "REC_LEAD") throw forbidden("Chỉ người đang giữ được leo thang", "NOT_ASSIGNEE");
    if (!["OPEN", "IN_PROGRESS"].includes(c.status)) throw invalidState(`Không leo thang được ngoại lệ ${c.status}`);
    const why = this.note(reason, "Lý do leo thang");
    // Leo thang = chuyển cho trưởng nhóm: nhả người giữ để REC_LEAD nhận (REQ-REC-03)
    this.db.patch("exception_cases", "case_id", caseId, { status: "ESCALATED", escalated_at: clock.now(), escalation_reason: why, owner_id: null, claimed_at: null });
    this.audit(actor, "CASE_ESCALATED", caseId, { from_owner: c.owner_id }, why);
    this.emit("rec.exception.escalated", caseId, { reason: why });
    return this.caseView(this.caseOrThrow(caseId));
  }

  /** Job RULE-REC-06: tự leo thang ngoại lệ quá hạn. PENDING_POSTING không leo thang (đã có bút toán chờ Checker) */
  escalateOverdue() {
    const now = clock.now();
    const due = this.db.all("SELECT case_id, due_at, owner_id FROM exception_cases WHERE status IN ('OPEN','IN_PROGRESS') AND due_at <= ?", now);
    for (const c of due) {
      const why = `Quá hạn xử lý ${Math.floor((now - c.due_at) / H)} giờ (RULE-REC-06)`;
      this.db.patch("exception_cases", "case_id", c.case_id, { status: "ESCALATED", escalated_at: now, escalation_reason: why, owner_id: null, claimed_at: null });
      this.audit(SYSTEM, "CASE_ESCALATED", c.case_id, undefined, why);
      this.emit("rec.exception.escalated", c.case_id, { reason: why, auto: true });
    }
    return due.length;
  }

  /** API-24 – xử lý ngoại lệ: ADJUSTMENT / MANUAL_MATCH / REQUEST_DOCS (REQ-REC-01, 02, 08) */
  resolve(actor: Staff, caseId: string, body: any) {
    const c = this.caseOrThrow(caseId);
    if (c.owner_id !== actor.id) throw forbidden("Bấm \"Nhận xử lý\" trước khi xử lý ngoại lệ", "NOT_ASSIGNEE");
    const allowed = c.status === "IN_PROGRESS" || (c.status === "ESCALATED" && actor.role === "REC_LEAD");
    if (!allowed) {
      if (c.status === "PENDING_POSTING") {
        const p = this.openEntryOf(caseId);
        throw new ApiError(409, "ADJUSTMENT_PENDING", `Đã có bút toán ${p?.entry_id} đang chờ Checker`, { entry_id: p?.entry_id });
      }
      throw invalidState(`Không xử lý được ngoại lệ ở trạng thái ${c.status}`);
    }

    // Nguyên nhân: trong top-3 gợi ý, hoặc override sang danh mục chuẩn kèm ghi chú
    const rc = body?.root_cause ?? {};
    const code = String(rc.code ?? "") as CauseCode;
    const top3 = j<Cause[]>(c.ai_causes, []).slice(0, 3).map((x) => x.code);
    const override = !!rc.override;
    if (!(code in CAUSE_CATALOGUE) || (!override && !top3.includes(code))) throw validation("Mã nguyên nhân không thuộc top-3 gợi ý hoặc danh mục chuẩn", "UNKNOWN_CAUSE");
    const rcNote = override ? this.note(rc.note, "Ghi chú nguyên nhân") : null;
    const base = { root_cause_code: code, root_cause_override: override ? 1 : 0, root_cause_note: rcNote, resolution_type: body?.type };
    const now = clock.now();

    const result = this.db.tx(() => {
      if (body?.type === "ADJUSTMENT") {
        const open = this.openEntryOf(caseId);
        if (open) throw new ApiError(409, "ADJUSTMENT_PENDING", `Đã có bút toán ${open.entry_id} đang chờ Checker`, { entry_id: open.entry_id });
        const adj = body.adjustment ?? {};
        const memo = String(adj.memo ?? "").trim();
        if (memo.length < 4) throw validation("Diễn giải bút toán tối thiểu 4 ký tự");
        const lines = this.lines(adj.lines);
        const rule = this.ruleOfMatch(c.match_id);
        const entry = this.createEntry({ case_id: caseId, source_rule_id: rule?.rule_id ?? null, source_rule_version: rule?.version ?? null,
          amount: lines.total, currency: c.currency, memo, maker: actor, lines: lines.rows });
        const posted = entry.status === "POSTED";
        this.db.patch("exception_cases", "case_id", caseId, { ...base, docs_request_note: null, status: posted ? "RESOLVED" : "PENDING_POSTING", closed_at: posted ? now : null });
        return { entry };
      }
      if (body?.type === "MANUAL_MATCH") {
        const t = this.db.get("SELECT * FROM source_transactions WHERE txn_id = ? OR reference_no = ?", body.manual_match_txn_id, String(body.manual_match_txn_id ?? "").toUpperCase());
        if (!t || t.side !== "EXTERNAL") throw validation("manual_match_txn_id phải là một giao dịch đối tác có trong hệ thống");
        if (t.match_status === "MATCHED") throw invalidState(`Giao dịch ${t.reference_no} đã được khớp`);
        if (t.currency !== c.currency) throw validation("Giao dịch đối ứng khác loại tiền");
        const internal = this.db.get("SELECT t.* FROM match_items mi JOIN source_transactions t ON t.txn_id = mi.txn_id WHERE mi.match_id = ? AND mi.side = 'INTERNAL'", c.match_id)!;
        const mId = this.db.nextId("match", "M-", 1, 7);
        this.db.run("INSERT INTO match_results(match_id, rule_id, rule_version, status, score, run_id, matched_by, matched_at) VALUES(?, NULL, NULL, 'MATCHED', 1, 'MANUAL', ?, ?)", mId, actor.id, now);
        this.db.run("INSERT INTO match_items(match_id, txn_id, side) VALUES(?,?, 'INTERNAL'), (?,?, 'EXTERNAL')", mId, internal.txn_id, mId, t.txn_id);
        this.db.run("UPDATE source_transactions SET match_status = 'MATCHED' WHERE txn_id IN (?, ?)", internal.txn_id, t.txn_id);
        this.db.patch("exception_cases", "case_id", caseId, { ...base, manual_match_txn_id: t.txn_id, docs_request_note: null, status: "RESOLVED", closed_at: now });
        return { match_id: mId };
      }
      if (body?.type === "REQUEST_DOCS") {
        const docs = this.note(body.docs_request_note, "Nội dung yêu cầu chứng từ");
        this.db.patch("exception_cases", "case_id", caseId, { ...base, docs_request_note: docs, status: "IN_PROGRESS" });
        return {};
      }
      throw validation("type phải là ADJUSTMENT, MANUAL_MATCH hoặc REQUEST_DOCS");
    });
    if (override) this.audit(actor, "ROOT_CAUSE_OVERRIDE", caseId, { code, ai_top3: top3 }, rcNote!);
    const after = this.caseOrThrow(caseId);
    if (after.status === "RESOLVED") this.audit(actor, "CASE_RESOLVED", caseId, { resolution_type: body.type });
    return { case: this.caseView(after), ...result };
  }

  /* ================= §5.4 Bút toán (UC-REC-05, RULE-REC-04/08) ================= */

  /** Kiểm dòng bút toán: ≥ 2 dòng, mã tài khoản hợp lệ, số tiền > 0, tổng Nợ = tổng Có (RULE-REC-08) */
  private lines(raw: unknown) {
    if (!Array.isArray(raw) || raw.length < 2) throw validation("Bút toán cần ít nhất 1 dòng Nợ và 1 dòng Có", "UNBALANCED_ENTRY");
    const rows = raw.map((l: any, i: number) => {
      if (l?.side !== "DEBIT" && l?.side !== "CREDIT") throw validation(`Dòng ${i + 1}: side phải là DEBIT hoặc CREDIT`);
      if (!ACCOUNT_CODE.test(String(l.account_code ?? ""))) throw validation(`Dòng ${i + 1}: mã tài khoản GL không hợp lệ (vd. 1131.01)`);
      return { side: l.side as "DEBIT" | "CREDIT", account_code: String(l.account_code), amount_minor: toMinor(l.amount, `lines[${i}].amount`) };
    });
    const sum = (s: string) => rows.filter((r) => r.side === s).reduce((a, r) => a + r.amount_minor, 0);
    const debit = sum("DEBIT"), credit = sum("CREDIT");
    if (!debit || debit !== credit) throw validation(`Tổng Nợ (${fromMinor(debit)}) phải bằng tổng Có (${fromMinor(credit)})`, "UNBALANCED_ENTRY", { debit: fromMinor(debit), credit: fromMinor(credit) });
    return { rows, total: debit };
  }

  /** Tạo bút toán. ≤ ngưỡng → ZERO_TOUCH POSTED; > ngưỡng → MAKER_CHECKER PENDING (RULE-REC-04) */
  private createEntry(e: {
    case_id?: string | null; match_id?: string | null; reversal_of?: string | null; auth_id?: string | null; inbound_message_id?: string | null;
    source_rule_id: string | null; source_rule_version: number | null; amount: number; currency: string; memo: string; maker: Staff;
    lines: { side: "DEBIT" | "CREDIT"; account_code: string; amount_minor: number }[]; business_date?: string;
  }) {
    const c = this.cfg();
    const now = clock.now();
    const zero = e.amount <= c.gl_threshold_minor;
    const id = this.db.nextId("gl", "GL-", 90309, 5);
    this.db.run(`INSERT INTO gl_entries(entry_id, case_id, match_id, reversal_of, auth_id, inbound_message_id, source_rule_id, source_rule_version, amount_minor, currency, memo,
      mode, status, maker_id, business_date, created_at, posted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, e.case_id ?? null, e.match_id ?? null, e.reversal_of ?? null, e.auth_id ?? null, e.inbound_message_id ?? null, e.source_rule_id, e.source_rule_version,
      e.amount, e.currency, e.memo, zero ? "ZERO_TOUCH" : "MAKER_CHECKER", zero ? "POSTED" : "PENDING", e.maker.id, e.business_date ?? vnDate(now), now, zero ? now : null);
    e.lines.forEach((l, i) => this.db.run("INSERT INTO gl_lines(entry_id, line_no, side, account_code, amount_minor) VALUES(?,?,?,?,?)", id, i + 1, l.side, l.account_code, l.amount_minor));
    this.db.run("INSERT INTO gl_approvals(entry_id, action, actor_id, created_at) VALUES(?, 'CREATED', ?, ?)", id, e.maker.id, now);
    this.audit(e.maker, "GL_CREATED", id, { amount: fromMinor(e.amount), mode: zero ? "ZERO_TOUCH" : "MAKER_CHECKER", case_id: e.case_id ?? null });
    this.emit(zero ? "rec.gl.posted" : "rec.gl.pending_approval", id, { amount: fromMinor(e.amount) });
    return this.entryView(this.db.get("SELECT * FROM gl_entries WHERE entry_id = ?", id)!);
  }

  private entryView(g: Row) {
    const rule = g.source_rule_id ? this.db.get("SELECT created_by, updated_by FROM matching_rules WHERE rule_id = ? AND version = ?", g.source_rule_id, g.source_rule_version) : null;
    return {
      entry_id: g.entry_id, case_id: g.case_id, match_id: g.match_id, reversal_of: g.reversal_of, auth_id: g.auth_id,
      source_rule_id: g.source_rule_id, source_rule_version: g.source_rule_version, rule_created_by: rule?.created_by ?? null, rule_created_by_name: this.nameOf(rule?.created_by),
      amount: fromMinor(g.amount_minor), amount_minor: g.amount_minor, currency: g.currency, memo: g.memo, mode: g.mode, status: g.status,
      maker_id: g.maker_id, maker_name: this.nameOf(g.maker_id), checker_id: g.checker_id, checker_name: this.nameOf(g.checker_id),
      submit_count: g.submit_count, return_note: g.return_note, reject_reason: g.reject_reason, escalated_to: g.escalated_to,
      business_date: g.business_date, created_at: g.created_at, posted_at: g.posted_at,
      lines: this.db.all("SELECT line_no, side, account_code, amount_minor FROM gl_lines WHERE entry_id = ? ORDER BY line_no", g.entry_id)
        .map((l): Row => ({ ...l, amount: fromMinor(l.amount_minor) })),
    };
  }
  private entryOrThrow(id: string) {
    return this.db.get("SELECT * FROM gl_entries WHERE entry_id = ?", id) ?? (() => { throw notFound(`bút toán ${id}`); })();
  }

  /** API-30, 31 */
  entries(q: { status?: string | null; mode?: string | null }) {
    return this.db.all("SELECT * FROM gl_entries WHERE (? IS NULL OR status = ?) AND (? IS NULL OR mode = ?) ORDER BY created_at DESC, entry_id DESC",
      q.status ?? null, q.status ?? null, q.mode ?? null, q.mode ?? null).map((g) => this.entryView(g));
  }
  entry(id: string) {
    const g = this.entryOrThrow(id);
    return { ...this.entryView(g), history: this.db.all("SELECT action, actor_id, note, created_at FROM gl_approvals WHERE entry_id = ? ORDER BY id", id).map((h): Row => ({ ...h, actor_name: this.nameOf(h.actor_id) })) };
  }

  /** Kiểm chung cho duyệt / trả về / từ chối: vai trò, trạng thái, SoD-1 */
  private checkerGuard(actor: Staff, g: Row) {
    this.require(actor, GL_APPROVERS, "duyệt bút toán");
    if (g.status === "POSTED") throw new ApiError(409, "ENTRY_IMMUTABLE", `${g.entry_id} đã hạch toán, không thay đổi được`);
    const ok = g.status === "PENDING" || (g.status === "ESCALATED" && actor.role === "REC_LEAD");
    if (!ok) throw invalidState(`${g.entry_id} không ở trạng thái chờ duyệt (${g.status})`);
    if (g.maker_id === actor.id) this.sodBlock(actor, g.entry_id, "SOD_MAKER_SAME", `Không thể duyệt ${g.entry_id}: bạn là Maker của bút toán này`);
  }
  private log(entryId: string, action: string, actor: Staff, note?: string) {
    this.db.run("INSERT INTO gl_approvals(entry_id, action, actor_id, note, created_at) VALUES(?,?,?,?,?)", entryId, action, actor.id, note ?? null, clock.now());
  }

  /** API-34 – duyệt. SoD-2: bút toán > ngưỡng không do người tạo/sửa quy tắc sinh giao dịch duyệt (RULE-REC-05, REQ-REC-07) */
  approveEntry(actor: Staff, id: string) {
    const g = this.entryOrThrow(id);
    this.checkerGuard(actor, g);
    if (g.amount_minor > this.cfg().gl_threshold_minor && g.source_rule_id) {
      const r = this.db.get("SELECT created_by, updated_by FROM matching_rules WHERE rule_id = ? AND version = ?", g.source_rule_id, g.source_rule_version);
      if (r && (r.created_by === actor.id || r.updated_by === actor.id))
        this.sodBlock(actor, id, "SOD_RULE_CREATOR", `Không thể duyệt ${id}: bạn là người tạo quy tắc ${g.source_rule_id} sinh ra giao dịch này (RULE-REC-05)`);
    }
    const now = clock.now();
    this.db.tx(() => {
      this.db.patch("gl_entries", "entry_id", id, { status: "POSTED", checker_id: actor.id, posted_at: now });
      if (g.case_id) this.db.run("UPDATE exception_cases SET status = 'RESOLVED', closed_at = ? WHERE case_id = ? AND status <> 'RESOLVED'", now, g.case_id);
      this.log(id, "APPROVED", actor);
    });
    this.audit(actor, "GL_APPROVED", id, { amount: fromMinor(g.amount_minor) });
    if (g.case_id) this.audit(actor, "CASE_RESOLVED", g.case_id, { via: id });
    this.emit("rec.gl.posted", id, { amount: fromMinor(g.amount_minor) });
    return this.entry(id);
  }

  /** API-35, 36 – trả về (REQ-REC-06) / từ chối (REQ-REC-05). Ngoại lệ liên quan mở lại IN_PROGRESS */
  returnOrReject(actor: Staff, id: string, kind: "return" | "reject", text: unknown) {
    const g = this.entryOrThrow(id);
    this.checkerGuard(actor, g);
    const why = this.note(text, kind === "return" ? "Ghi chú trả về" : "Lý do từ chối");
    this.db.tx(() => {
      this.db.patch("gl_entries", "entry_id", id, kind === "return"
        ? { status: "RETURNED", checker_id: actor.id, return_note: why }
        : { status: "REJECTED", checker_id: actor.id, reject_reason: why });
      if (g.case_id) this.db.run("UPDATE exception_cases SET status = 'IN_PROGRESS' WHERE case_id = ? AND status = 'PENDING_POSTING'", g.case_id);
      this.log(id, kind === "return" ? "RETURNED" : "REJECTED", actor, why);
    });
    this.audit(actor, kind === "return" ? "GL_RETURNED" : "GL_REJECTED", id, undefined, why);
    return this.entry(id);
  }

  /** API-37 – Maker trình lại, giữ mã bút toán, tăng submit_count; có thể sửa diễn giải và dòng */
  resubmitEntry(actor: Staff, id: string, body: { memo?: string; lines?: unknown }) {
    const g = this.entryOrThrow(id);
    if (g.maker_id !== actor.id) throw forbidden("Chỉ Maker của bút toán được trình lại", "NOT_MAKER");
    if (g.status !== "RETURNED") throw invalidState(`${id} không ở trạng thái trả về`);
    // Sửa số tiền khi trình lại không đổi cơ chế: bút toán đã vào Maker-Checker thì luôn qua Checker (không né kiểm soát bằng cách hạ số)
    const lines = body.lines !== undefined ? this.lines(body.lines) : null;
    this.db.tx(() => {
      this.db.patch("gl_entries", "entry_id", id, {
        status: "PENDING", submit_count: g.submit_count + 1, memo: body.memo?.trim() || g.memo, ...(lines ? { amount_minor: lines.total } : {}),
      });
      if (lines) {
        this.db.run("DELETE FROM gl_lines WHERE entry_id = ?", id);
        lines.rows.forEach((l, i) => this.db.run("INSERT INTO gl_lines(entry_id, line_no, side, account_code, amount_minor) VALUES(?,?,?,?,?)", id, i + 1, l.side, l.account_code, l.amount_minor));
      }
      if (g.case_id) this.db.run("UPDATE exception_cases SET status = 'PENDING_POSTING' WHERE case_id = ? AND status = 'IN_PROGRESS'", g.case_id);
      this.log(id, "RESUBMITTED", actor);
    });
    this.audit(actor, "GL_RESUBMITTED", id, { submit_count: g.submit_count + 1 });
    return this.entry(id);
  }

  /** API-38 – chuyển cấp duyệt cao hơn (REQ-REC-10, Should) */
  escalateEntry(actor: Staff, id: string, body: { to?: string; reason?: unknown }) {
    const g = this.entryOrThrow(id);
    this.require(actor, GL_APPROVERS, "chuyển cấp bút toán");
    if (g.status !== "PENDING") throw invalidState(`${id} không ở trạng thái chờ duyệt`);
    if (!["COMPLIANCE", "HIGHER_APPROVER"].includes(String(body.to))) throw validation("to phải là COMPLIANCE hoặc HIGHER_APPROVER");
    const why = this.note(body.reason, "Lý do chuyển cấp");
    this.db.patch("gl_entries", "entry_id", id, { status: "ESCALATED", escalated_to: body.to });
    this.log(id, "ESCALATED", actor, why);
    this.audit(actor, "GL_ESCALATED", id, { to: body.to }, why);
    return this.entry(id);
  }

  /** API-39 – đảo bút toán đã post bằng bút toán mới (REQ-REC-11) */
  reverseEntry(actor: Staff, id: string, reason: unknown) {
    this.require(actor, ["REC_LEAD"], "đảo bút toán");
    const g = this.entryOrThrow(id);
    if (g.status !== "POSTED") throw invalidState("Chỉ đảo được bút toán đã hạch toán");
    if (g.reversal_of) throw invalidState("Không đảo một bút toán đảo");
    if (this.db.get("SELECT 1 FROM gl_entries WHERE reversal_of = ? AND status <> 'REJECTED'", id)) throw invalidState(`${id} đã có bút toán đảo`);
    const why = this.note(reason, "Lý do đảo");
    const lines = this.db.all("SELECT side, account_code, amount_minor FROM gl_lines WHERE entry_id = ? ORDER BY line_no", id)
      .map((l) => ({ side: (l.side === "DEBIT" ? "CREDIT" : "DEBIT") as "DEBIT" | "CREDIT", account_code: l.account_code, amount_minor: l.amount_minor }));
    const r = this.db.tx(() => this.createEntry({ reversal_of: id, auth_id: g.auth_id, source_rule_id: g.source_rule_id, source_rule_version: g.source_rule_version,
      amount: g.amount_minor, currency: g.currency, memo: `Đảo ${id}: ${why}`, maker: actor, lines }));
    this.audit(actor, "GL_REVERSED", id, { reversal: r.entry_id }, why);
    return r;
  }

  /* ================= §5.5 Truy vết (BR-REC-10, REQ-REC-19) ================= */

  lineage(q: { entry_id?: string | null; case_id?: string | null; txn_id?: string | null }) {
    const orphans: string[] = [];
    let entry: Row | undefined, kase: Row | undefined, matchId: string | null = null;
    if (q.entry_id) {
      entry = this.db.get("SELECT * FROM gl_entries WHERE entry_id = ?", q.entry_id);
      if (!entry) throw notFound(`bút toán ${q.entry_id}`);
      if (entry.reversal_of) entry = this.db.get("SELECT * FROM gl_entries WHERE entry_id = ?", entry.reversal_of) ?? entry;
      if (entry.case_id) { kase = this.db.get("SELECT * FROM exception_cases WHERE case_id = ?", entry.case_id); if (!kase) orphans.push(`GL_ENTRY ${entry.entry_id} → case ${entry.case_id}`); }
      matchId = kase?.match_id ?? entry.match_id ?? null;
    } else if (q.case_id) {
      kase = this.caseOrThrow(q.case_id);
      matchId = kase.match_id;
      entry = this.db.get("SELECT * FROM gl_entries WHERE case_id = ? ORDER BY created_at DESC LIMIT 1", q.case_id);
    } else if (q.txn_id) {
      const t = this.db.get("SELECT * FROM source_transactions WHERE txn_id = ? OR reference_no = ?", q.txn_id, q.txn_id);
      if (!t) throw notFound(`giao dịch ${q.txn_id}`);
      matchId = this.db.get("SELECT match_id FROM match_items WHERE txn_id = ? ORDER BY match_id DESC LIMIT 1", t.txn_id)?.match_id ?? null;
      if (!matchId) orphans.push(`SOURCE_TRANSACTION ${t.txn_id} chưa có MATCH_RESULT`);
      kase = matchId ? this.db.get("SELECT * FROM exception_cases WHERE match_id = ?", matchId) : undefined;
      entry = kase ? this.db.get("SELECT * FROM gl_entries WHERE case_id = ? ORDER BY created_at DESC LIMIT 1", kase.case_id)
        : matchId ? this.db.get("SELECT * FROM gl_entries WHERE match_id = ?", matchId) : undefined;
    } else throw validation("Cần entry_id, case_id hoặc txn_id");

    // Ngoại lệ đã khớp thủ công: kết quả khớp mới thay cho kết quả UNMATCHED ban đầu
    const manualMatch = kase?.manual_match_txn_id ? this.db.get("SELECT match_id FROM match_items WHERE txn_id = ? ORDER BY match_id DESC LIMIT 1", kase.manual_match_txn_id)?.match_id : null;
    const m = matchId ? this.db.get("SELECT * FROM match_results WHERE match_id = ?", manualMatch ?? matchId) : undefined;
    if (matchId && !m) orphans.push(`MATCH_RESULT ${matchId} không tồn tại`);
    const items = m ? this.db.all("SELECT t.* FROM match_items mi LEFT JOIN source_transactions t ON t.txn_id = mi.txn_id WHERE mi.match_id = ?", m.match_id) : [];
    if (m && !items.length) orphans.push(`MATCH_RESULT ${m.match_id} không có giao dịch`);
    if (items.some((t) => !t.txn_id)) orphans.push(`MATCH_RESULT ${m!.match_id} trỏ tới giao dịch không tồn tại`);
    const internal = items.find((t) => t.side === "INTERNAL");
    const chain = [
      { step: "SOURCE_TRANSACTION", id: internal?.txn_id ?? null, ref: internal?.reference_no ?? null, source: internal?.source ?? null },
      { step: "MATCH_RESULT", id: m?.match_id ?? null, status: m ? (m.matched_by !== "engine" ? "MATCHED_MANUAL" : m.status) : null,
        note: !m ? "Không có kết quả khớp" : m.status === "UNMATCHED" ? "Không tìm thấy đối ứng" : items.filter((t) => t.side === "EXTERNAL").map((t) => t.reference_no).join(", ") },
      { step: "EXCEPTION_CASE", id: kase?.case_id ?? null, status: kase?.status ?? null, note: kase ? null : "Khớp tự động, không có ngoại lệ" },
      { step: "GL_ENTRY", id: entry?.entry_id ?? null, status: entry?.status ?? null,
        note: entry ? null : kase?.resolution_type === "MANUAL_MATCH" ? "Không cần hạch toán" : "Chưa hạch toán" },
    ];
    if (entry && entry.case_id === null && entry.match_id === null && !entry.inbound_message_id && !entry.reversal_of) orphans.push(`GL_ENTRY ${entry.entry_id} không có nguồn`);
    return { chain, integrity: { ok: orphans.length === 0, orphans } };
  }

  /* ================= §5.6 Báo cáo (UC-REC-06) ================= */

  kpi(q: { from?: number; to?: number; source?: string | null; rule_type?: string | null }) {
    const from = q.from ?? clock.now() - 7 * D, to = q.to ?? clock.now();
    const src = q.source?.toUpperCase() ?? null;
    // Tỷ lệ khớp tự động: giao dịch nội bộ khớp bởi engine ÷ giao dịch nội bộ đã chạy engine trong kỳ
    const ran = this.db.all(`SELECT mr.status, mr.matched_by, mr.rule_id, r.type FROM match_results mr
      JOIN match_items mi ON mi.match_id = mr.match_id AND mi.side = 'INTERNAL'
      JOIN source_transactions t ON t.txn_id = mi.txn_id
      LEFT JOIN matching_rules r ON r.rule_id = mr.rule_id AND r.version = mr.rule_version
      WHERE mr.run_id <> 'MANUAL' AND mr.matched_at BETWEEN ? AND ? AND (? IS NULL OR t.channel = ? OR t.source = ?)`, from, to, src, src, src)
      .filter((r) => !q.rule_type || r.type === q.rule_type);
    const auto = ran.filter((r) => r.status === "MATCHED").length;
    const closed = this.db.all("SELECT opened_at, closed_at FROM exception_cases WHERE closed_at BETWEEN ? AND ? AND (? IS NULL OR source_pair LIKE '%' || ? || '%')", from, to, src, src);
    const mttr = closed.length ? closed.reduce((s, c) => s + (c.closed_at - c.opened_at), 0) / closed.length / H : null;
    const unmatched = this.db.get<{ v: number; n: number }>(`SELECT coalesce(sum(diff_minor), 0) v, count(*) n FROM exception_cases WHERE status <> 'RESOLVED' AND (? IS NULL OR source_pair LIKE '%' || ? || '%')`, src, src)!;
    const posted = this.db.all("SELECT mode FROM gl_entries WHERE status = 'POSTED' AND posted_at BETWEEN ? AND ?", from, to);
    const zero = posted.filter((p) => p.mode === "ZERO_TOUCH").length;
    const c = this.cfg();
    return {
      from, to, source: src, rule_type: q.rule_type ?? null,
      auto_match_rate: ran.length ? Math.round((auto / ran.length) * 1000) / 10 : null, auto_match_target: 95, matched: auto, processed: ran.length,
      mttr_hours: mttr === null ? null : Math.round(mttr * 10) / 10, mttr_target_hours: 4,
      unmatched_value: fromMinor(unmatched.v), unmatched_value_minor: unmatched.v, open_exceptions: unmatched.n,
      zero_touch_rate: posted.length ? Math.round((zero / posted.length) * 1000) / 10 : null, zero_touch_target: c.zero_touch_target_pct,
      pending_approval: this.db.get<{ n: number }>("SELECT count(*) n FROM gl_entries WHERE status IN ('PENDING','ESCALATED')")!.n,
    };
  }
  /** API-51 – CSV cùng bộ lọc (REQ-REC-17). Dấu ; để Excel tiếng Việt mở đúng cột */
  kpiCsv(q: Parameters<RecService["kpi"]>[0]) {
    const k = this.kpi(q);
    const rows: [string, unknown][] = [["Từ", new Date(k.from).toISOString()], ["Đến", new Date(k.to).toISOString()], ["Nguồn", k.source ?? "Tất cả"],
      ["Tỷ lệ khớp tự động (%)", k.auto_match_rate], ["MTTR (giờ)", k.mttr_hours], ["Giá trị chưa khớp (VND)", k.unmatched_value],
      ["Ngoại lệ đang mở", k.open_exceptions], ["Zero-touch (%)", k.zero_touch_rate], ["Bút toán chờ duyệt", k.pending_approval]];
    return "﻿Chỉ số;Giá trị\n" + rows.map(([a, b]) => `${a};${b ?? ""}`).join("\n") + "\n";
  }
  /** API-52 – số ngoại lệ theo nguyên nhân (đã chọn; ngoại lệ chưa xử lý tính theo gợi ý số 1) */
  causes(q: { from?: number; to?: number }) {
    const from = q.from ?? clock.now() - 30 * D, to = q.to ?? clock.now();
    const rows = this.db.all("SELECT root_cause_code, ai_causes FROM exception_cases WHERE opened_at BETWEEN ? AND ?", from, to);
    const count = new Map<string, number>();
    for (const r of rows) {
      const code = r.root_cause_code ?? j<Cause[]>(r.ai_causes, [])[0]?.code ?? "OTHER";
      count.set(code, (count.get(code) ?? 0) + 1);
    }
    return [...count.entries()].map(([code, n]) => ({ code, ...CAUSE_CATALOGUE[code as CauseCode], count: n })).sort((a, b) => b.count - a.count);
  }

  /* ================= §5.7–5.8 Sự kiện từ Hạn mức và đối chiếu cuối ngày ================= */

  /** Consumer limit.authorization.processed – chống trùng theo messageId (TC-REC-B09). Luôn trả ack, không ném lỗi cho Pub/Sub */
  consumeLimitEvent(msg: { messageId?: string; data?: any }) {
    const id = String(msg.messageId ?? "");
    if (!id) return { ack: true, status: "IGNORED", reason: "thiếu messageId" };
    const seen = this.db.get("SELECT status, entry_id FROM inbound_events WHERE message_id = ?", id);
    if (seen) return { ack: true, status: "DUPLICATE", entry_id: seen.entry_id };
    const now = clock.now();
    const p = msg.data ?? {};
    this.db.run("INSERT INTO inbound_events(message_id, type, payload, status, received_at) VALUES(?, 'limit.authorization.processed', ?, 'RECEIVED', ?)", id, JSON.stringify(p), now);
    try {
      const entryId = this.db.tx(() => {
        if (!p.auth_id) throw new Error("thiếu auth_id");
        if (p.result === "DECLINE") return null; // từ chối cấp phép: không phát sinh bút toán
        const amount = toMinor(p.amount), cur = ccy(p.currency ?? "VND");
        const date = vnDate(Number(p.processed_at ?? now));
        const c = this.cfg();
        if (p.result === "REVERSED") {
          const orig = this.db.get("SELECT entry_id FROM gl_entries WHERE auth_id = ? AND reversal_of IS NULL AND status <> 'REJECTED' ORDER BY created_at LIMIT 1", p.auth_id);
          if (!orig) throw new Error(`không có bút toán gốc cho ${p.auth_id}`);
          return this.createEntry({ reversal_of: orig.entry_id, auth_id: p.auth_id, inbound_message_id: id, source_rule_id: null, source_rule_version: null, amount, currency: cur,
            memo: `Đảo cấp phép ${p.auth_id}`, maker: SYSTEM, business_date: date,
            lines: [{ side: "DEBIT", account_code: c.gl_limit_credit, amount_minor: amount }, { side: "CREDIT", account_code: c.gl_limit_debit, amount_minor: amount }] }).entry_id;
        }
        if (p.result !== "APPROVE") throw new Error(`result không hợp lệ: ${p.result}`);
        return this.createEntry({ auth_id: p.auth_id, inbound_message_id: id, source_rule_id: null, source_rule_version: null, amount, currency: cur,
          memo: `Cấp phép thẻ ${p.card_id ?? ""} ${p.auth_id}`.replace(/\s+/g, " "), maker: SYSTEM, business_date: date,
          lines: [{ side: "DEBIT", account_code: c.gl_limit_debit, amount_minor: amount }, { side: "CREDIT", account_code: c.gl_limit_credit, amount_minor: amount }] }).entry_id;
      });
      this.db.run("UPDATE inbound_events SET status = 'PROCESSED', entry_id = ?, processed_at = ? WHERE message_id = ?", entryId, clock.now(), id);
      return { ack: true, status: "PROCESSED", entry_id: entryId };
    } catch (e) {
      this.db.run("UPDATE inbound_events SET status = 'FAILED', error = ?, processed_at = ? WHERE message_id = ?", (e as Error).message, clock.now(), id);
      return { ack: true, status: "FAILED", error: (e as Error).message };
    }
  }

  /** Ảnh chụp Ledger của Hạn mức cho ngày nghiệp vụ (production đọc từ limit-service; bản dev nạp qua API dev) */
  loadLimitLedger(rows: { auth_id: string; business_date: string; amount: string; currency?: string; result: string }[]) {
    this.db.tx(() => rows.forEach((r) => this.db.run("INSERT OR REPLACE INTO limit_ledger(auth_id, business_date, amount_minor, currency, result) VALUES(?,?,?,?,?)",
      r.auth_id, r.business_date, toMinor(r.amount), ccy(r.currency ?? "VND"), r.result)));
    return { loaded: rows.length };
  }

  /** Đối chiếu cuối ngày (REQ-REC-20, SCRUM-53). Mọi dòng lệch có người phụ trách ngay khi tạo */
  runEod(businessDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw validation("business_date dạng YYYY-MM-DD");
    const now = clock.now();
    const ledger = new Map(this.db.all("SELECT * FROM limit_ledger WHERE business_date = ? AND result = 'APPROVE'", businessDate).map((r) => [r.auth_id, r]));
    // Số dư ròng theo auth_id: bút toán gốc trừ bút toán đảo (đang chờ hoặc đã post)
    const net = new Map<string, { amount: number; entry: string }>();
    for (const g of this.db.all("SELECT * FROM gl_entries WHERE auth_id IS NOT NULL AND business_date = ? AND status IN ('POSTED','PENDING','ESCALATED')", businessDate)) {
      const cur = net.get(g.auth_id) ?? { amount: 0, entry: g.entry_id };
      cur.amount += g.reversal_of ? -g.amount_minor : g.amount_minor;
      if (!g.reversal_of) cur.entry = g.entry_id;
      net.set(g.auth_id, cur);
    }
    const lead = this.db.get<{ id: string }>("SELECT id FROM staff WHERE role = 'REC_LEAD' ORDER BY id LIMIT 1")?.id ?? null;
    const runId = this.db.nextId(`eod-${businessDate}`, `EOD-${businessDate.replaceAll("-", "")}-`, 1, 2);
    return this.db.tx(() => {
      const diffs: Row[] = [];
      for (const [auth, l] of ledger) {
        const g = net.get(auth);
        if (!g || g.amount === 0) diffs.push({ auth_id: auth, entry_id: g?.entry ?? null, diff_type: "MISSING_GL" });
        else if (g.amount !== l.amount_minor) diffs.push({ auth_id: auth, entry_id: g.entry, diff_type: "AMOUNT_MISMATCH" });
      }
      for (const [auth, g] of net) if (g.amount !== 0 && !ledger.has(auth)) diffs.push({ auth_id: auth, entry_id: g.entry, diff_type: "MISSING_LEDGER" });
      const ledgerTotal = [...ledger.values()].reduce((s, r) => s + r.amount_minor, 0);
      const glVals = [...net.values()].filter((g) => g.amount !== 0);
      this.db.run(`INSERT INTO eod_runs(run_id, business_date, started_at, finished_at, ledger_count, ledger_total_minor, gl_count, gl_total_minor, diff_count)
        VALUES(?,?,?,?,?,?,?,?,?)`, runId, businessDate, now, clock.now(), ledger.size, ledgerTotal, glVals.length, glVals.reduce((s, g) => s + g.amount, 0), diffs.length);
      diffs.forEach((d, i) => this.db.run("INSERT INTO eod_diffs(diff_id, run_id, auth_id, entry_id, diff_type, owner_id) VALUES(?,?,?,?,?,?)",
        `${runId}-D${String(i + 1).padStart(3, "0")}`, runId, d.auth_id, d.entry_id, d.diff_type, lead));
      this.emit("rec.eod.completed", runId, { business_date: businessDate, diff_count: diffs.length });
      return this.eodRun(runId);
    });
  }
  eodRuns(date?: string | null) {
    return this.db.all("SELECT * FROM eod_runs WHERE (? IS NULL OR business_date = ?) ORDER BY started_at DESC", date ?? null, date ?? null).map((r) => this.eodRunView(r));
  }
  private eodRunView(r: Row): Row {
    return { ...r, ledger_total: fromMinor(r.ledger_total_minor || 0), gl_total: fromMinor(r.gl_total_minor || 0) };
  }
  eodRun(runId: string): Row {
    const r = this.db.get("SELECT * FROM eod_runs WHERE run_id = ?", runId);
    if (!r) throw notFound(`lần đối chiếu ${runId}`);
    return { ...this.eodRunView(r), diffs: this.eodDiffs(runId) };
  }
  eodDiffs(runId: string, status?: string | null) {
    return this.db.all("SELECT * FROM eod_diffs WHERE run_id = ? AND (? IS NULL OR status = ?) ORDER BY diff_id", runId, status ?? null, status ?? null)
      .map((d): Row => ({ ...d, owner_name: this.nameOf(d.owner_id) }));
  }
  /** API-62 */
  assignDiff(actor: Staff, runId: string, diffId: string, ownerId: string) {
    this.require(actor, ["REC_LEAD"], "phân công dòng lệch");
    const owner = this.staff(ownerId);
    if (!REC.includes(owner.role)) throw validation(`${owner.name} không thuộc nhóm đối soát`);
    const d = this.db.get("SELECT * FROM eod_diffs WHERE run_id = ? AND diff_id = ?", runId, diffId);
    if (!d) throw notFound(`dòng lệch ${diffId}`);
    this.db.run("UPDATE eod_diffs SET owner_id = ? WHERE diff_id = ?", owner.id, diffId);
    this.audit(actor, "EOD_DIFF_ASSIGNED", diffId, { from: d.owner_id, to: owner.id });
    return this.eodDiffs(runId).find((x) => x.diff_id === diffId);
  }

  /* ================= Cấu hình qua Maker-Checker (NFR-SEC-05) ================= */

  configView() {
    return { values: this.cfg(), bounds: CONFIG_BOUNDS, pending: this.db.all("SELECT * FROM config_changes WHERE status = 'PENDING' ORDER BY id") };
  }
  requestConfigChange(actor: Staff, b: { key?: string; value?: unknown; reason?: unknown }) {
    this.require(actor, ["REC_LEAD", "FIN_VIEWER"], "đề xuất đổi cấu hình");
    const key = String(b.key) as ConfigKey;
    if (!(key in DEFAULT_CONFIG)) throw validation(`Không có tham số ${key}`);
    const def = DEFAULT_CONFIG[key];
    const value = typeof def === "number" ? Number(b.value) : String(b.value ?? "");
    const bounds = CONFIG_BOUNDS[key];
    if (typeof def === "number" && (!Number.isFinite(value as number) || (bounds && ((value as number) < bounds[0] || (value as number) > bounds[1]))))
      throw validation(`${key} phải trong [${bounds?.join(", ")}]`, "OUT_OF_RANGE", { min: bounds?.[0], max: bounds?.[1] });
    if (typeof def === "string" && !ACCOUNT_CODE.test(value as string)) throw validation(`${key} phải là mã tài khoản GL`);
    const why = this.note(b.reason, "Lý do thay đổi");
    if (this.db.get("SELECT 1 FROM config_changes WHERE key = ? AND status = 'PENDING'", key)) throw invalidState(`${key} đã có đề xuất chờ duyệt`);
    const r = this.db.run("INSERT INTO config_changes(key, old_value, new_value, reason, requested_by, status, created_at) VALUES(?,?,?,?,?, 'PENDING', ?)",
      key, JSON.stringify(this.cfg()[key]), JSON.stringify(value), why, actor.id, clock.now());
    this.audit(actor, "CONFIG_CHANGE_REQUESTED", key, { from: this.cfg()[key], to: value }, why);
    return this.db.get("SELECT * FROM config_changes WHERE id = ?", Number(r.lastInsertRowid));
  }
  decideConfigChange(actor: Staff, id: number, approve: boolean) {
    this.require(actor, ["REC_LEAD", "FIN_VIEWER"], "duyệt đổi cấu hình");
    const ch = this.db.get("SELECT * FROM config_changes WHERE id = ? AND status = 'PENDING'", id);
    if (!ch) throw invalidState("Không có đề xuất chờ duyệt");
    if (ch.requested_by === actor.id) this.sodBlock(actor, String(id), "SOD_MAKER_SAME", "Người đề xuất không tự duyệt thay đổi cấu hình");
    this.db.tx(() => {
      this.db.run("UPDATE config_changes SET status = ?, approved_by = ?, decided_at = ? WHERE id = ?", approve ? "APPROVED" : "REJECTED", actor.id, clock.now(), id);
      if (approve) this.db.run("INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ch.key, ch.new_value);
    });
    this.audit(actor, approve ? "CONFIG_CHANGE_APPROVED" : "CONFIG_CHANGE_REJECTED", ch.key, { to: JSON.parse(ch.new_value) });
    return this.configView();
  }

  /** Danh sách người dùng cho màn REC-03 (chọn Checker) và phần đổi vai trò UAT */
  meta() {
    return { staff: this.db.all("SELECT id, name, role FROM staff ORDER BY role, name"), causes: CAUSE_CATALOGUE, threshold: fromMinor(this.cfg().gl_threshold_minor), threshold_display: vnd(this.cfg().gl_threshold_minor) };
  }
}
